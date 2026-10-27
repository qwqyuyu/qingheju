/* ==========================================
   config/validate.js — 输入校验规则
   ------------------------------------------
   与数据库字段长度保持一致，避免把超长/非法数据
   丢给 MySQL 后变成 500。
   ========================================== */

/* 用户名：2-20 位中文、字母、数字、下划线或短横线。
   禁止引号、尖括号、空格等可用于 HTML/属性注入的字符。 */
const USERNAME_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = Object.freeze({
    username: 20,
    title: 100,          /* posts.title VARCHAR(100) */
    content: 15000,      /* posts.content TEXT，留足 utf8mb4 字节余量 */
    comment: 500,        /* comments.content VARCHAR(500) */
    email: 100,          /* users.email VARCHAR(100) */
    passwordMin: 6,
    passwordMax: 64,
    passwordBytes: 72    /* bcrypt 只处理前 72 字节 */
});

function charLength(value) {
    return Array.from(String(value)).length;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidUsername(value) {
    return typeof value === 'string' && USERNAME_RE.test(value);
}

function isValidEmail(value) {
    return typeof value === 'string'
        && value.length <= LIMITS.email
        && EMAIL_RE.test(value);
}

function isStrongEnoughPassword(value) {
    return typeof value === 'string'
        && charLength(value) >= LIMITS.passwordMin
        && charLength(value) <= LIMITS.passwordMax
        && Buffer.byteLength(value, 'utf8') <= LIMITS.passwordBytes;
}

module.exports = {
    LIMITS,
    charLength,
    isNonEmptyString,
    isValidUsername,
    isValidEmail,
    isStrongEnoughPassword
};
