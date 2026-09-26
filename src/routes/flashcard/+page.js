// export const prerender = true; // needed for static adapter

// import initSqlJs from 'sql.js';

// export async function load({ fetch }) {
//     const SQL = await initSqlJs({
//         locateFile: () => '/sql-wasm.wasm'
//     });

//     const params = new URLSearchParams(window.location.search);
//     const category = params.get('category'); 
//     const n = params.get('n'); 

//     const res = await fetch('/questions.db');
//     const buffer = await res.arrayBuffer();
//     const db = new SQL.Database(new Uint8Array(buffer));

//     const stmt = db.prepare("SELECT * FROM questions WHERE category = ? ORDER BY problemset LIMIT 1 OFFSET ?");
//     stmt.bind([category, n - 1]);
//     stmt.step();

//     const result = stopImmediatePropagation.getAsObject();

//     stmt.free()
//     db.close();

//     return {
//         columns: result[0]?.columns ?? [],
//         rows: result[0]?.values ?? []
//     };
// }