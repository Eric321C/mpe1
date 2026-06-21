const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'laporan-aktivitas-super-secret-key-2026';

// 1. Inisialisasi Database MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'laporan_aktivitas_karyawan',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Sangat penting agar tipe DATE/DATETIME dibaca sebagai string untuk kompatibilitas frontend
});

console.log('Database terhubung via MySQL Connection Pool');

// 2. Inisialisasi Skema & Seeding Data Awal (jika kosong)
async function initializeDb() {
  try {
    // Membuat tabel users jika belum ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        nama_lengkap VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'foreman',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Pastikan kolom role ada pada tabel users (jika database sudah terbuat sebelumnya)
    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
      if (columns.length === 0) {
        console.log('Menambahkan kolom `role` ke tabel `users`...');
        await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'foreman'");
      } else {
        // Update default value dari kolom role menjadi 'foreman'
        await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'foreman'");
      }
    } catch (colErr) {
      console.warn('Gagal memeriksa/menambahkan/mengubah default kolom role:', colErr);
    }

    // Jalankan migrasi data role lama ke role baru jika ada
    try {
      const [resMigrateKaryawan] = await pool.query("UPDATE users SET role = 'foreman' WHERE role = 'karyawan'");
      const [resMigrateAdmin] = await pool.query("UPDATE users SET role = 'superintendent' WHERE role = 'admin'");
      if (resMigrateKaryawan.affectedRows > 0 || resMigrateAdmin.affectedRows > 0) {
        console.log(`Migrasi role berhasil: ${resMigrateKaryawan.affectedRows} karyawan -> foreman, ${resMigrateAdmin.affectedRows} admin -> superintendent.`);
      }
    } catch (migrateErr) {
      console.warn('Gagal memigrasikan role lama:', migrateErr);
    }

    // Membuat tabel daily_reports jika belum ada
    await pool.query(`
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

    // Membuat tabel suggestions jika belum ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Cek apakah database kosong, jika ya lakukan seeding
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      console.log('Database kosong. Melakukan seeding data awal...');

      const hashedPassword = bcrypt.hashSync('password123', 10);
      const adminPassword = bcrypt.hashSync('admin123', 10);

      const [user1] = await pool.query(
        'INSERT INTO users (username, nama_lengkap, password, role) VALUES (?, ?, ?, ?)',
        ['budi', 'Budi Santoso', hashedPassword, 'foreman']
      );
      const [user2] = await pool.query(
        'INSERT INTO users (username, nama_lengkap, password, role) VALUES (?, ?, ?, ?)',
        ['ani', 'Ani Wijaya', hashedPassword, 'supervisor']
      );
      const [user3] = await pool.query(
        'INSERT INTO users (username, nama_lengkap, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'Administrator', adminPassword, 'superintendent']
      );

      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      await pool.query(`
        INSERT INTO daily_reports (user_id, tanggal, todo_list, done_list, kendala)
        VALUES (?, ?, ?, ?, ?)
      `, [
        user1.insertId,
        yesterdayStr,
        "- Menyusun desain database laporan harian\n- Membuat draf tampilan UI",
        "- Selesai membuat ERD database di cetak biru\n- Selesai menyusun sketsa kasar dashboard",
        "Sempat terkendala mati listrik selama 1 jam di sore hari"
      ]);

      await pool.query(`
        INSERT INTO daily_reports (user_id, tanggal, todo_list, done_list, kendala)
        VALUES (?, ?, ?, ?, ?)
      `, [
        user1.insertId,
        todayStr,
        "- Implementasi backend Express.js\n- Setup database SQLite dan inisialisasi tabel",
        "- Backend server.js dasar selesai dibuat\n- SQLite terintegrasi dengan baik menggunakan modul bawaan node:sqlite",
        ""
      ]);

      await pool.query(`
        INSERT INTO daily_reports (user_id, tanggal, todo_list, done_list, kendala)
        VALUES (?, ?, ?, ?, ?)
      `, [
        user2.insertId,
        todayStr,
        "- Membuat desain frontend dengan tema Dark Mode premium\n- Menyusun file CSS dan layout HTML",
        "- Selesai mendesain UI dashboard dan kartu laporan\n- Efek glassmorphism dan transisi CSS siap diintegrasikan",
        "Mencari palet warna gelap yang harmonis membutuhkan waktu tambahan"
      ]);

      console.log('Seeding data awal berhasil diselesaikan!');
    }
  } catch (err) {
    console.error('Gagal inisialisasi / seed database:', err);
  }
}

initializeDb();

// 3. Setup Express Middleware
// Custom CORS Middleware to handle credentials and dynamic origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// 4. Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.status(403).json({ error: 'Sesi kedaluwarsa atau token tidak valid.' });
  }
};

// 5. Endpoint API Autentikasi

// A. Register
app.post('/api/auth/register', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const employeeRoles = ['supervisor', 'foreman'];
  const allRoles = [...adminRoles, ...employeeRoles];

  // Hanya manajemen yang bisa mendaftarkan akun baru
  if (!req.user.role || !adminRoles.includes(req.user.role.toLowerCase())) {
    return res.status(403).json({ error: 'Akses ditolak. Hanya Manajemen yang dapat mendaftarkan akun baru.' });
  }

  const { username, nama_lengkap, password, role } = req.body;

  // Validasi input
  if (!username || !nama_lengkap || !password || !role) {
    return res.status(400).json({ error: 'Semua kolom registrasi wajib diisi.' });
  }

  if (username.length < 3 || username.includes(' ')) {
    return res.status(400).json({ error: 'Username minimal 3 karakter dan tidak boleh mengandung spasi.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal terdiri dari 6 karakter.' });
  }

  let userRole = 'foreman';
  if (role && allRoles.includes(role.toLowerCase())) {
    userRole = role.toLowerCase();
  }

  try {
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username sudah digunakan.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (username, nama_lengkap, password, role) VALUES (?, ?, ?, ?)',
      [username.toLowerCase(), nama_lengkap, hashedPassword, userRole]
    );

    return res.status(201).json({
      message: `Akun baru (${nama_lengkap}) dengan peran ${userRole} berhasil didaftarkan!`
    });
  } catch (err) {
    console.error('Register Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem saat registrasi.' });
  }
});

// B. Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
    const user = users[0];

    if (!user) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Username atau password salah.' });
    }

    // Buat JWT Token
    const userPayload = {
      id: user.id,
      username: user.username,
      nama_lengkap: user.nama_lengkap,
      role: user.role
    };
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
      sameSite: 'none',
      secure: true
    });

    return res.json({
      message: 'Login berhasil!',
      user: userPayload
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem saat login.' });
  }
});

// C. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'none',
    secure: true
  });
  return res.json({ message: 'Berhasil logout.' });
});

// D. Get Current User Info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

// 6. Endpoint API Laporan Aktivitas Harian

// A. Tambah Laporan Baru
app.post('/api/reports', authenticateToken, async (req, res) => {
  const { tanggal, todo_list, done_list, kendala } = req.body;

  if (!tanggal || !todo_list) {
    return res.status(400).json({ error: 'Kolom Tanggal dan Rencana Kerja (To-Do) wajib diisi.' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(tanggal) || isNaN(Date.parse(tanggal))) {
    return res.status(400).json({ error: 'Format tanggal tidak valid. Harap gunakan format YYYY-MM-DD.' });
  }

  try {
    const [result] = await pool.query(`
      INSERT INTO daily_reports (user_id, tanggal, todo_list, done_list, kendala)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.user.id,
      tanggal,
      todo_list.trim(),
      done_list ? done_list.trim() : '',
      kendala ? kendala.trim() : ''
    ]);

    return res.status(201).json({
      message: 'Laporan berhasil disimpan!',
      reportId: result.insertId
    });
  } catch (err) {
    console.error('Insert Report Error:', err);
    return res.status(500).json({ error: 'Gagal menyimpan laporan ke database.' });
  }
});

// B. Dapatkan Laporan Pribadi (Riwayat Kerja)
app.get('/api/reports/my', authenticateToken, async (req, res) => {
  try {
    const [reports] = await pool.query(`
      SELECT * FROM daily_reports 
      WHERE user_id = ? 
      ORDER BY tanggal DESC, created_at DESC
    `, [req.user.id]);
    return res.json({ reports });
  } catch (err) {
    console.error('Get My Reports Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil riwayat laporan Anda.' });
  }
});

// C. Dapatkan Laporan Semua Pengguna (Feed / Timeline Bersama)
app.get('/api/reports/feed', authenticateToken, async (req, res) => {
  try {
    const [feed] = await pool.query(`
      SELECT r.id, r.user_id, r.tanggal, r.todo_list, r.done_list, r.kendala, r.created_at, 
             u.nama_lengkap, u.username, u.role
      FROM daily_reports r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.tanggal DESC, r.created_at DESC
    `);
    return res.json({ feed });
  } catch (err) {
    console.error('Get Feed Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil linimasa aktivitas rekan kerja.' });
  }
});

// D. Dapatkan Semua Daftar Karyawan beserta Jumlah Laporan
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const [employees] = await pool.query(`
      SELECT u.id, u.username, u.nama_lengkap, u.role, COUNT(r.id) AS report_count
      FROM users u
      LEFT JOIN daily_reports r ON u.id = r.user_id
      WHERE u.role NOT IN ('gm', 'manager', 'superintendent')
      GROUP BY u.id
      ORDER BY u.nama_lengkap ASC
    `);
    return res.json({ employees });
  } catch (err) {
    console.error('Get Employees Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil daftar karyawan.' });
  }
});

// E. Dapatkan Laporan Karyawan Spesifik
app.get('/api/reports/employee/:id', authenticateToken, async (req, res) => {
  const employeeId = req.params.id;
  try {
    const [reports] = await pool.query(`
      SELECT r.id, r.user_id, r.tanggal, r.todo_list, r.done_list, r.kendala, r.created_at,
             u.nama_lengkap, u.username
      FROM daily_reports r
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ?
      ORDER BY r.tanggal DESC, r.created_at DESC
    `, [employeeId]);
    return res.json({ reports });
  } catch (err) {
    console.error('Get Employee Reports Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil laporan karyawan.' });
  }
});

// F. Dapatkan Laporan Spesifik berdasarkan ID
app.get('/api/reports/:id', authenticateToken, async (req, res) => {
  const reportId = req.params.id;
  try {
    const [reports] = await pool.query('SELECT * FROM daily_reports WHERE id = ?', [reportId]);
    if (reports.length === 0) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    // Pastikan user adalah pemilik laporan
    if (reports[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk melihat laporan ini.' });
    }

    return res.json({ report: reports[0] });
  } catch (err) {
    console.error('Get Report Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data laporan.' });
  }
});

// G. Update Laporan Spesifik berdasarkan ID
app.put('/api/reports/:id', authenticateToken, async (req, res) => {
  const reportId = req.params.id;
  const { tanggal, todo_list, done_list, kendala } = req.body;

  if (!tanggal || !todo_list) {
    return res.status(400).json({ error: 'Kolom Tanggal dan Rencana Kerja (To-Do) wajib diisi.' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(tanggal) || isNaN(Date.parse(tanggal))) {
    return res.status(400).json({ error: 'Format tanggal tidak valid. Harap gunakan format YYYY-MM-DD.' });
  }

  try {
    const [reports] = await pool.query('SELECT user_id FROM daily_reports WHERE id = ?', [reportId]);
    if (reports.length === 0) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    if (reports[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk mengedit laporan ini.' });
    }

    await pool.query(`
      UPDATE daily_reports 
      SET tanggal = ?, todo_list = ?, done_list = ?, kendala = ?
      WHERE id = ?
    `, [
      tanggal,
      todo_list.trim(),
      done_list ? done_list.trim() : '',
      kendala ? kendala.trim() : '',
      reportId
    ]);

    return res.json({ message: 'Laporan berhasil diperbarui!' });
  } catch (err) {
    console.error('Update Report Error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui laporan ke database.' });
  }
});

// H. Hapus Laporan berdasarkan ID
app.delete('/api/reports/:id', authenticateToken, async (req, res) => {
  const reportId = req.params.id;
  try {
    const [reports] = await pool.query('SELECT user_id FROM daily_reports WHERE id = ?', [reportId]);
    if (reports.length === 0) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    if (reports[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses untuk menghapus laporan ini.' });
    }

    await pool.query('DELETE FROM daily_reports WHERE id = ?', [reportId]);
    return res.json({ message: 'Laporan berhasil dihapus.' });
  } catch (err) {
    console.error('Delete Report Error:', err);
    return res.status(500).json({ error: 'Gagal menghapus laporan dari database.' });
  }
});

// ==========================================================================
// SUGGESTION BOX API ENDPOINTS
// ==========================================================================

// A. Submit Suggestion
app.post('/api/suggestions', authenticateToken, async (req, res) => {
  const { title, category, content } = req.body;
  if (!title || !category || !content) {
    return res.status(400).json({ error: 'Semua kolom saran wajib diisi.' });
  }

  try {
    await pool.query(`
      INSERT INTO suggestions (user_id, title, category, content)
      VALUES (?, ?, ?, ?)
    `, [req.user.id, title.trim(), category, content.trim()]);

    return res.status(201).json({ message: 'Saran Anda berhasil dikirim!' });
  } catch (err) {
    console.error('Submit Suggestion Error:', err);
    return res.status(500).json({ error: 'Gagal mengirimkan saran ke database.' });
  }
});

// B. Get Suggestions (All for admin, own for staff)
app.get('/api/suggestions', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = req.user.role && adminRoles.includes(req.user.role.toLowerCase());

  try {
    let query = '';
    let params = [];

    if (isAdmin) {
      query = `
        SELECT s.*, u.nama_lengkap, u.username, u.role
        FROM suggestions s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
      `;
    } else {
      query = `
        SELECT s.*, u.nama_lengkap, u.username, u.role
        FROM suggestions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
        ORDER BY s.created_at DESC
      `;
      params = [req.user.id];
    }

    const [suggestions] = await pool.query(query, params);
    return res.json({ suggestions });
  } catch (err) {
    console.error('Get Suggestions Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data kotak saran.' });
  }
});

// C. Update Suggestion Status (Admin Only)
app.put('/api/suggestions/:id/status', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = req.user.role && adminRoles.includes(req.user.role.toLowerCase());

  if (!isAdmin) {
    return res.status(403).json({ error: 'Akses ditolak. Hanya manajemen yang dapat merubah status saran.' });
  }

  const { status } = req.body;
  const suggestionId = req.params.id;

  if (!status) {
    return res.status(400).json({ error: 'Status wajib ditentukan.' });
  }

  try {
    await pool.query('UPDATE suggestions SET status = ? WHERE id = ?', [status, suggestionId]);
    return res.json({ message: `Status saran berhasil diubah menjadi: ${status}` });
  } catch (err) {
    console.error('Update Suggestion Status Error:', err);
    return res.status(500).json({ error: 'Gagal memperbarui status saran.' });
  }
});

// D. Delete Suggestion
app.delete('/api/suggestions/:id', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = req.user.role && adminRoles.includes(req.user.role.toLowerCase());
  const suggestionId = req.params.id;

  try {
    const [suggestions] = await pool.query('SELECT user_id FROM suggestions WHERE id = ?', [suggestionId]);
    if (suggestions.length === 0) {
      return res.status(404).json({ error: 'Saran tidak ditemukan.' });
    }

    // Pemilik atau admin bisa menghapus
    if (suggestions[0].user_id !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki hak untuk menghapus saran ini.' });
    }

    await pool.query('DELETE FROM suggestions WHERE id = ?', [suggestionId]);
    return res.json({ message: 'Saran berhasil dihapus.' });
  } catch (err) {
    console.error('Delete Suggestion Error:', err);
    return res.status(500).json({ error: 'Gagal menghapus saran dari database.' });
  }
});

// ==========================================================================
// USER ADMINISTRATION (MASTER DATA) API
// ==========================================================================

// A. Get All Users (Admin Only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = req.user.role && adminRoles.includes(req.user.role.toLowerCase());

  if (!isAdmin) {
    return res.status(403).json({ error: 'Akses ditolak. Hanya Manajemen yang dapat melihat daftar pengguna.' });
  }

  try {
    const [users] = await pool.query(`
      SELECT id, username, nama_lengkap, role, created_at,
             (SELECT COUNT(*) FROM daily_reports WHERE user_id = users.id) AS report_count
      FROM users
      ORDER BY nama_lengkap ASC
    `);
    return res.json({ users });
  } catch (err) {
    console.error('Get Admin Users Error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data seluruh pengguna.' });
  }
});

// B. Delete User Account (Admin Only)
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  const adminRoles = ['superintendent', 'manager', 'gm'];
  const isAdmin = req.user.role && adminRoles.includes(req.user.role.toLowerCase());

  if (!isAdmin) {
    return res.status(403).json({ error: 'Akses ditolak. Hanya Manajemen yang dapat menghapus akun.' });
  }

  const deleteId = req.params.id;

  // Tidak boleh menghapus diri sendiri
  if (parseInt(deleteId) === parseInt(req.user.id)) {
    return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
  }

  try {
    const [users] = await pool.query('SELECT username FROM users WHERE id = ?', [deleteId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [deleteId]);
    return res.json({ message: `Akun @${users[0].username} berhasil dihapus dari sistem.` });
  } catch (err) {
    console.error('Delete User Error:', err);
    return res.status(500).json({ error: 'Gagal menghapus pengguna dari database.' });
  }
});

// 7. Route Fallback untuk Single Page Application (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 8. Jalankan Server
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server Laporan Aktivitas Harian berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;
