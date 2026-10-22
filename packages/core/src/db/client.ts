import pg from "pg";
import pgvector from "pgvector/pg";

const url = process.env.DATABASE_URL ?? "postgres://rag:rag@localhost:5432/rag";

export const pool = new pg.Pool({ connectionString: url });

// Lets us pass number[] as `vector` params and read vectors back as number[].
pool.on("connect", (client) => {
  void pgvector.registerTypes(client);
});
