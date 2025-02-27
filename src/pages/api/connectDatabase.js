// pages/api/connectDatabase.js
import { Pool as PostgresPool } from "pg";
import mysql from "mysql2/promise";
import mssql from "mssql";

let dbConnection = null;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { host, port, user, password, database, dbType } = req.body;

    try {
        // Close any existing connections to prevent multiple open connections
        if (dbConnection) {
            (await dbConnection.end) ? dbConnection.end() : mssql.close();
        }

        if (dbType === "postgres") {
            // PostgreSQL connection
            dbConnection = new PostgresPool({
                host,
                port,
                user,
                password,
                database,
            });
            await dbConnection.query("SELECT NOW()"); // Test the connection
        } else if (dbType === "mysql") {
            // MySQL connection
            dbConnection = await mysql.createConnection({
                host,
                port,
                user,
                password,
                database,
            });
            await dbConnection.execute("SELECT 1"); // Test the connection
        } else if (dbType === "mssql") {
            // MSSQL connection
            dbConnection = await mssql.connect({
                server: host,
                port: parseInt(port),
                user,
                password,
                database,
                options: {
                    encrypt: true, // Use encryption for MSSQL connections
                    trustServerCertificate: true, // Trust the server certificate
                },
            });
            await dbConnection.request().query("SELECT GETDATE()"); // Test the connection
        } else {
            return res.status(400).json({ error: "Unsupported database type" });
        }

        res.status(200).json({
            success: true,
            message: "Database connected successfully!",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to connect to database",
        });
    }
}
