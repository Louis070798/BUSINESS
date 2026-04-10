const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware xác thực JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Không có token xác thực' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', decoded.id)
      .where('users.is_active', true)
      .select('users.*', 'roles.code as role_code', 'roles.name as role_name', 'roles.permissions')
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role_id: user.role_id,
      role_code: user.role_code,
      role_name: user.role_name,
      permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token đã hết hạn' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    return res.status(500).json({ error: 'Lỗi xác thực' });
  }
};

// Middleware phân quyền
const authorize = (entity, action) => {
  return (req, res, next) => {
    const { permissions, role_code } = req.user;

    // Admin có toàn quyền
    if (role_code === 'admin') return next();

    if (!permissions || !permissions[entity] || !permissions[entity].includes(action)) {
      return res.status(403).json({
        error: 'Bạn không có quyền thực hiện thao tác này',
        required: `${entity}.${action}`,
      });
    }

    next();
  };
};

// Middleware ghi log
const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    const originalSend = res.json;
    res.json = function (data) {
      // Ghi log sau khi response thành công
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        db('audit_logs').insert({
          user_id: req.user.id,
          user_name: req.user.full_name,
          action: action,
          entity_type: entityType,
          entity_id: data?.id || req.params?.id,
          new_values: req.method !== 'GET' ? JSON.stringify(req.body) : null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          description: `${req.user.full_name} đã ${action} ${entityType}`,
        }).catch(err => console.error('Audit log error:', err));
      }
      return originalSend.call(this, data);
    };
    next();
  };
};

module.exports = { authenticate, authorize, auditLog };
