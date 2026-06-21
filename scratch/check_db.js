const mysql = require('mysql2/promise');

async function checkDb() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'laporan_aktivitas_karyawan'
  });

  try {
    const [users] = await connection.query('SELECT id, username, nama_lengkap, role FROM users');
    console.log('--- USERS IN DATABASE ---');
    console.log(users);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await connection.end();
  }
}

checkDb();
