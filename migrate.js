const { DatabaseSync } = require('node:sqlite');
const mysql = require('mysql2/promise');
const path = require('path');

async function runMigration() {
  console.log('--- MEMULAI MIGRASI DATABASE (SQLITE -> MYSQL XAMPP) ---');

  // 1. Koneksi ke database SQLite
  const sqliteDbPath = path.join(__dirname, 'database.sqlite');
  console.log(`Menghubungkan ke SQLite di: ${sqliteDbPath}`);
  let sqliteDb;
  try {
    sqliteDb = new DatabaseSync(sqliteDbPath);
  } catch (err) {
    console.error('Gagal menghubungkan ke SQLite:', err);
    process.exit(1);
  }

  // 2. Koneksi ke server MySQL XAMPP (tanpa menentukan database terlebih dahulu)
  console.log('Menghubungkan ke MySQL XAMPP (localhost:3306)...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: ''
    });
    console.log('Koneksi awal MySQL berhasil!');
  } catch (err) {
    console.error('Gagal menghubungkan ke MySQL XAMPP. Pastikan modul MySQL di XAMPP Control Panel sudah dinyalakan.', err);
    process.exit(1);
  }

  try {
    // 3. Buat database jika belum ada
    console.log('Membuat database "laporan_aktivitas_karyawan" jika belum ada...');
    await connection.query('CREATE DATABASE IF NOT EXISTS `laporan_aktivitas_karyawan`;');
    await connection.query('USE `laporan_aktivitas_karyawan`;');

    // 4. Buat tabel users jika belum ada
    console.log('Membuat tabel `users` di MySQL...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Buat tabel daily_reports jika belum ada
    console.log('Membuat tabel `daily_reports` di MySQL...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tanggal DATE NOT NULL,
        todo_list TEXT NOT NULL,
        done_list TEXT NOT NULL,
        kendala TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 6. Ambil dan pindahkan data tabel `users`
    console.log('Membaca data user dari SQLite...');
    const selectUsersStmt = sqliteDb.prepare('SELECT * FROM users');
    const sqliteUsers = selectUsersStmt.all();
    console.log(`Menemukan ${sqliteUsers.length} user di SQLite.`);

    for (const u of sqliteUsers) {
      console.log(`Memigrasikan user: ${u.username} (ID: ${u.id})...`);
      // Simpan user dengan mempertahankan ID asli
      await connection.query(`
        INSERT INTO users (id, username, nama_lengkap, password, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          nama_lengkap = VALUES(nama_lengkap),
          password = VALUES(password)
      `, [u.id, u.username, u.nama_lengkap, u.password, u.created_at]);
    }
    console.log('Migrasi tabel `users` sukses!');

    // 7. Ambil dan pindahkan data tabel `daily_reports`
    console.log('Membaca data laporan dari SQLite...');
    const selectReportsStmt = sqliteDb.prepare('SELECT * FROM daily_reports');
    const sqliteReports = selectReportsStmt.all();
    console.log(`Menemukan ${sqliteReports.length} laporan di SQLite.`);

    for (const r of sqliteReports) {
      console.log(`Memigrasikan laporan ID: ${r.id} (User ID: ${r.user_id})...`);
      await connection.query(`
        INSERT INTO daily_reports (id, user_id, tanggal, todo_list, done_list, kendala, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          tanggal = VALUES(tanggal),
          todo_list = VALUES(todo_list),
          done_list = VALUES(done_list),
          kendala = VALUES(kendala),
          created_at = VALUES(created_at)
      `, [r.id, r.user_id, r.tanggal, r.todo_list, r.done_list, r.kendala, r.created_at]);
    }
    console.log('Migrasi tabel `daily_reports` sukses!');

    console.log('--- MIGRASI DATABASE BERHASIL DISELESAIKAN ---');
  } catch (err) {
    console.error('Terjadi kesalahan selama proses migrasi:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Koneksi MySQL ditutup.');
    }
  }
}

runMigration();
