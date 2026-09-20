const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
require("dotenv").config();

async function executeSqlFile(connection, fileName) {
  const filePath = path.join(
    __dirname,
    "..",
    "database",
    fileName
  );

  const sql = fs.readFileSync(filePath, "utf8");

  let statements;

  if (fileName === "03_triggers.sql") {
    statements = [sql.trim()];
  } else {
    statements = sql
      .split(";")
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
  }

  for (const statement of statements) {
    try {
      await connection.execute(statement);
      console.log(`Created successfully (${fileName}).`);
    } catch (error) {
      if (error.errorNum === 955) {
        console.log(`Already exists - skipped (${fileName}).`);
      } else {
        throw error;
      }
    }
  }
}

async function setupDatabase() {
  let connection;

  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING
    });

    console.log("Connected to Oracle.");

    await executeSqlFile(connection, "01_schema.sql");
    await executeSqlFile(connection, "02_sequences.sql");
    await executeSqlFile(connection, "03_triggers.sql");

    await connection.commit();

    console.log("");
    console.log("Database setup completed successfully.");
console.log("18-table FitTrack schema is ready.");
    console.log("Sequences are ready.");
    console.log("Triggers are ready.");

  } catch (error) {
    console.error("");
    console.error("Database setup failed:");
    console.error(error.message);

    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError.message);
      }
    }

    process.exitCode = 1;

  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

setupDatabase();