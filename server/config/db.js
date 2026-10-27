/* ==========================================
   config/db.js — MySQL 连接池
   支持环境变量（部署用）和默认值（本地开发用）
   ========================================== */

const mysql = require('mysql2/promise');
const { offsetString } = require('./time');

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'qingheju',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true
});

/* 让数据库会话使用与业务一致的时区，
   保证 CURRENT_TIMESTAMP / NOW() 写进去的就是本地时间 */
pool.on('connection', (conn) => {
    conn.query('SET time_zone = ?', [offsetString()], () => {});
});

module.exports = pool;
