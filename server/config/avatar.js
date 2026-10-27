/* ==========================================
   config/avatar.js — 头像 URL 与解析
   ------------------------------------------
   列表接口只返回头像 URL，不再重复塞 base64；
   URL 带 avatar_version，头像更新后地址变化，
   浏览器可以放心长期缓存。
   ========================================== */

/* 只接受上传接口写入过的 data URL 格式 */
const AVATAR_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i;

/* 站内默认头像等路径 */
const AVATAR_PATH_RE = /^images\/[\w./-]+\.(?:png|jpe?g|svg|webp)$/i;

function avatarUrl(id, version) {
    const v = Number(version);
    return '/api/users/' + id + '/avatar?v=' + (Number.isFinite(v) ? v : 0);
}

module.exports = { avatarUrl, AVATAR_DATA_RE, AVATAR_PATH_RE };
