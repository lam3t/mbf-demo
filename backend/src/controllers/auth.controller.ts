import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { CONFIG } from '../config';
import { JwtPayload, User } from '../types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class AuthController {
  static login(req: Request, res: Response): void {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
        return;
      }

      const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
      const user = stmt.get(username) as User | undefined;

      if (!user) {
        res.status(401).json({ success: false, message: 'Tài khoản không tồn tại trên hệ thống.' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ success: false, message: 'Tài khoản này hiện đang bị khóa. Vui lòng liên hệ Quản trị viên.' });
        return;
      }

      const isMatch = bcrypt.compareSync(password, user.passwordHash || '');
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
        return;
      }

      const payload: JwtPayload = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        unit: user.unit
      };

      const token = jwt.sign(payload, CONFIG.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        message: 'Đăng nhập thành công.',
        token,
        user: payload
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getProfile(req: AuthenticatedRequest, res: Response): void {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
      return;
    }

    const stmt = db.prepare('SELECT id, username, fullName, role, unit, isActive, createdAt FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    res.json({ success: true, data: user });
  }

  static changePassword(req: AuthenticatedRequest, res: Response): void {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
        return;
      }

      const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
      const user = stmt.get(req.user?.id) as User | undefined;

      if (!user) {
        res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        return;
      }

      if (user.passwordHash && !bcrypt.compareSync(oldPassword, user.passwordHash)) {
        res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác.' });
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const newHash = bcrypt.hashSync(newPassword, salt);

      db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(newHash, user.id);

      res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
