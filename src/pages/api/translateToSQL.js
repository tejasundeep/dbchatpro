import axios from 'axios';
import { Pool as PostgresPool } from 'pg';
import mysql from 'mysql2/promise';
import mssql from 'mssql';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { userInput, dbCredentials } = req.body;
    const { dbType } = dbCredentials;

    // Validate that userInput and dbType are provided
    if (!userInput || !dbType) {
        return res.status(400).json({ message: 'Input data and dbType are required' });
    }

    let schema;

    try {
        // Step 1: Retrieve schema based on database type
        if (dbType === 'postgres') {
            const client = new PostgresPool({
                host: dbCredentials.host,
                port: dbCredentials.port,
                user: dbCredentials.user,
                password: dbCredentials.password,
                database: dbCredentials.database,
            });
            const result = await client.query(`
                SELECT table_name, column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
            `);
            await client.end();

            schema = result.rows.reduce((acc, row) => {
                acc[row.table_name] = acc[row.table_name] || [];
                acc[row.table_name].push({ name: row.column_name, type: row.data_type });
                return acc;
            }, {});

        } else if (dbType === 'mysql') {
            const connection = await mysql.createConnection({
                host: dbCredentials.host,
                port: dbCredentials.port,
                user: dbCredentials.user,
                password: dbCredentials.password,
                database: dbCredentials.database,
            });
            const [rows] = await connection.execute(`
                SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
            `, [dbCredentials.database]);
            await connection.end();

            schema = rows.reduce((acc, row) => {
                acc[row.table_name] = acc[row.table_name] || [];
                acc[row.table_name].push({ name: row.column_name, type: row.data_type });
                return acc;
            }, {});

        } else if (dbType === 'mssql') {
            const pool = await mssql.connect({
                user: dbCredentials.user,
                password: dbCredentials.password,
                server: dbCredentials.host,
                port: dbCredentials.port,
                database: dbCredentials.database,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                },
            });
            const result = await pool.request().query(`
                SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type
                FROM INFORMATION_SCHEMA.COLUMNS
            `);
            mssql.close();

            schema = result.recordset.reduce((acc, row) => {
                acc[row.table_name] = acc[row.table_name] || [];
                acc[row.table_name].push({ name: row.column_name, type: row.data_type });
                return acc;
            }, {});
        } else {
            return res.status(400).json({ message: 'Unsupported database type' });
        }

        // Step 2: Identify relevant table and columns based on user query
        const schemaDescription = Object.entries(schema).map(([table, columns]) => {
            return `Table ${table} with columns: ${columns.map(col => `${col.name} (${col.type})`).join(', ')}`;
        }).join('. ');

        // Step 3: Send user query along with schema to OpenAI to determine table and columns
        const aiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI assistant that translates natural language instructions into ${dbType} commands. 
                        Using the provided database schema ${schemaDescription}, identify the appropriate tables and columns to construct the ${dbType} command. 
                        Respond only with the ${dbType} command, without any additional text or comments. 
                        Ensure that timestamps follow this format for applicable columns and database types: TIMESTAMP DEFAULT CURRENT_TIMESTAMP. The database name is ${dbCredentials.database}.`
                    },
                    {
                        role: 'user',
                        content: userInput
                    }
                ],
                max_tokens: 1000,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
            }
        );
        
        // Step 4: Extract SQL from the AI's response
        const generatedSQL = aiResponse.data.choices[0].message.content;

        res.status(200).json({ result: generatedSQL });
    } catch (error) {
        // Handle errors gracefully and return a descriptive error response
        const statusCode = error.response ? error.response.status : 500;
        const message = error.response && error.response.data && error.response.data.error
            ? error.response.data.error.message
            : 'Error processing data';
        
        res.status(statusCode).json({ message });
    }
}
