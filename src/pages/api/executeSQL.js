import { Pool as PostgresPool } from 'pg';
import mysql from 'mysql2/promise';
import mssql from 'mssql';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { dbCredentials, sqlQuery } = req.body;

    if (!dbCredentials || !sqlQuery) {
        return res.status(400).json({ success: false, message: 'Database credentials and SQL query are required' });
    }

    const { dbType } = dbCredentials;
    let client;

    // Helper function to detect the type of SQL query
    const getQueryType = (query) => {
        const trimmedQuery = query.trim().toLowerCase();
        if (trimmedQuery.startsWith('select')) return 'SELECT';
        if (trimmedQuery.startsWith('insert')) return 'INSERT';
        if (trimmedQuery.startsWith('update')) return 'UPDATE';
        if (trimmedQuery.startsWith('delete')) return 'DELETE';
        if (trimmedQuery.startsWith('create')) return 'CREATE';
        if (trimmedQuery.startsWith('drop')) return 'DROP';
        if (trimmedQuery.startsWith('alter')) return 'ALTER';
        if (trimmedQuery.startsWith('truncate')) return 'TRUNCATE';
        return 'OTHER';
    };

    try {
        let result;
        const queryType = getQueryType(sqlQuery);

        if (dbType === 'postgres') {
            const pool = new PostgresPool({
                host: dbCredentials.host,
                port: dbCredentials.port,
                user: dbCredentials.user,
                password: dbCredentials.password,
                database: dbCredentials.database,
            });
            client = await pool.connect();

            if (queryType === 'SELECT') {
                result = await client.query(sqlQuery);
                res.status(200).json({ success: true, data: result.rows });
            } else {
                await client.query(sqlQuery);
                res.status(200).json({ success: true, message: `Query of type ${queryType} executed successfully.` });
            }

            client.release();
            await pool.end();

        } else if (dbType === 'mysql') {
            client = await mysql.createConnection({
                host: dbCredentials.host,
                port: dbCredentials.port,
                user: dbCredentials.user,
                password: dbCredentials.password,
                database: dbCredentials.database,
            });

            if (queryType === 'SELECT') {
                [result] = await client.execute(sqlQuery);
                res.status(200).json({ success: true, data: result });
            } else {
                await client.execute(sqlQuery);
                res.status(200).json({ success: true, message: `Query of type ${queryType} executed successfully.` });
            }

            await client.end();

        } else if (dbType === 'mssql') {
            await mssql.connect({
                server: dbCredentials.host,
                port: parseInt(dbCredentials.port, 10),
                user: dbCredentials.user,
                password: dbCredentials.password,
                database: dbCredentials.database,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                },
            });

            if (queryType === 'SELECT') {
                result = await mssql.query(sqlQuery);
                res.status(200).json({ success: true, data: result.recordset });
            } else {
                await mssql.query(sqlQuery);
                res.status(200).json({ success: true, message: `Query of type ${queryType} executed successfully.` });
            }

            await mssql.close();

        } else {
            return res.status(400).json({ success: false, message: 'Unsupported database type.' });
        }
    } catch (error) {
        // Detailed error handling for feedback
        const errorMessage = error.message || 'An unknown error occurred during SQL execution.';
        const errorDetails = {
            message: errorMessage,
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
        };

        res.status(400).json({ success: false, error: errorDetails });
    }
}
