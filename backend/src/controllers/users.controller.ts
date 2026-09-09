import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { User } from '../types';

export class UsersController {
  static getAll(req: Request, res: Response): void {
    try {
      const { unit, role, search } = req.query;
      let query = 'SELECT id, username, fullName, role, unit, isActive, createdAt FROM users WHERE 1=1';
      const params: any[] = [];

      if (unit) {
        query += ' AND unit = ?';
        params.push(unit);
      }
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      if (search) {
        query += ' AND (fullName LIKE ? OR username LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY id ASC';
      const users = db.prepare(query).all(...params);
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const user = db.prepare('SELECT id, username, fullName, role, unit, isActive, createdAt FROM users WHERE id = ?').get(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        return;
      }
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static create(req: Request, res: Response): void {
    try {
      const { username, password, fullName, role, unit } = req.body;
      if (!username || !password || !fullName || !role) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
        return;
      }

      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
        return;
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const stmt = db.prepare(`
        INSERT INTO users (username, passwordHash, fullName, role, unit, isActive, createdAt)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `);
      const result = stmt.run(username, passwordHash, fullName, role, unit || null);

      res.status(201).json({ success: true, message: 'Thêm mới người dùng thành công.', id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static update(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { fullName, role, unit, password } = req.body;

      let query = 'UPDATE users SET fullName = ?, role = ?, unit = ?';
      const params: any[] = [fullName, role, unit || null];

      if (password) {
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);
        query += ', passwordHash = ?';
        params.push(passwordHash);
      }

      query += ' WHERE id = ?';
      params.push(id);

      db.prepare(query).run(...params);
      res.json({ success: true, message: 'Cập nhật thông tin người dùng thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static toggleActive(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const user = db.prepare('SELECT isActive FROM users WHERE id = ?').get(id) as User | undefined;
      if (!user) {
        res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        return;
      }

      const nextState = user.isActive ? 0 : 1;
      db.prepare('UPDATE users SET isActive = ? WHERE id = ?').run(nextState, id);

      res.json({
        success: true,
        message: nextState === 1 ? 'Đã kích hoạt tài khoản.' : 'Đã khóa tài khoản.',
        isActive: nextState
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
