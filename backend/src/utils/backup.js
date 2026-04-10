const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');

// Đảm bảo thư mục backup tồn tại
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Backup database
 */
function backupDatabase() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

    const cmd = `PGPASSWORD="${DB_PASSWORD}" pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -F c -f "${filepath}"`;

    console.log(`[Backup] Đang backup database...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Backup] Lỗi: ${error.message}`);
        reject(error);
        return;
      }
      console.log(`[Backup] Thành công: ${filepath}`);
      resolve({ filepath, filename });
    });
  });
}

/**
 * Restore database
 */
function restoreDatabase(filepath) {
  return new Promise((resolve, reject) => {
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

    const cmd = `PGPASSWORD="${DB_PASSWORD}" pg_restore -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c "${filepath}"`;

    console.log(`[Restore] Đang restore database từ ${filepath}...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Restore] Lỗi: ${error.message}`);
        reject(error);
        return;
      }
      console.log(`[Restore] Thành công!`);
      resolve(true);
    });
  });
}

/**
 * Danh sách backup files
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({
      filename: f,
      filepath: path.join(BACKUP_DIR, f),
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      date: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
    }))
    .sort((a, b) => b.date - a.date);
}

// Chạy backup nếu gọi trực tiếp
if (require.main === module) {
  backupDatabase()
    .then(result => {
      console.log('Backup hoàn tất:', result.filename);
      process.exit(0);
    })
    .catch(err => {
      console.error('Backup thất bại:', err.message);
      process.exit(1);
    });
}

module.exports = { backupDatabase, restoreDatabase, listBackups };
