import { describe, it, expect } from 'vitest';
import { parseRoute, toHash } from '../js/router.js';
import { PARTS } from '../js/config.js';

// 這本書有幾頁（一頁一段）。app.js、coverView.js 呼叫 parseRoute 時都會把頁數傳進去，這裡也一樣
const PAGES = PARTS.length;

describe('parseRoute', () => {
  it('封面', () => {
    for (const h of ['', '#', '#/', undefined, null]) {
      expect(parseRoute(h, PAGES)).toEqual({ name: 'cover', route: '' });
    }
  });
  it('章節：這本書是第 1–11 頁', () => {
    expect(PAGES).toBe(11);
    expect(parseRoute('#/ch/1', PAGES)).toEqual({ name: 'ch', no: 1, route: 'ch/1' });
    expect(parseRoute('#/ch/3', PAGES)).toEqual({ name: 'ch', no: 3, route: 'ch/3' });
    expect(parseRoute('#/ch/11', PAGES)).toEqual({ name: 'ch', no: 11, route: 'ch/11' });
  });
  it('其他固定頁', () => {
    for (const name of ['toc', 'match', 'land', 'daily', 'about']) {
      expect(parseRoute(`#/${name}`, PAGES)).toEqual({ name, route: name });
    }
  });
  it('結尾多一條斜線也認得', () => {
    expect(parseRoute('#/toc/', PAGES)).toEqual({ name: 'toc', route: 'toc' });
    expect(parseRoute('#/ch/3/', PAGES)).toEqual({ name: 'ch', no: 3, route: 'ch/3' });
  });
  it('不存在的頁一律回封面（第 12 頁以後都沒有）', () => {
    for (const h of ['#/ch/0', '#/ch/12', '#/ch/13', '#/ch/14', '#/ch/99', '#/ch/abc', '#/ch/3x', '#/ch/-1', '#/ch/1.5', '#/ch/', '#/xyz', '#/toc/extra', '#ch/3', '#/CH/3']) {
      expect(parseRoute(h, PAGES), h).toEqual({ name: 'cover', route: '' });
    }
  });
  it('頁數上限由呼叫的人指定', () => {
    expect(parseRoute('#/ch/14', 20).name).toBe('ch');
    expect(parseRoute('#/ch/13', 12).name).toBe('cover');
  });
  it('沒給頁數上限時，跟頁數無關的網址照樣認得', () => {
    expect(parseRoute('#/ch/3')).toEqual({ name: 'ch', no: 3, route: 'ch/3' });
    expect(parseRoute('#/land')).toEqual({ name: 'land', route: 'land' });
    for (const h of ['', '#/ch/0', '#/ch/99', '#/xyz']) expect(parseRoute(h), h).toEqual({ name: 'cover', route: '' });
  });
  it('沒給頁數上限時的預設值是這本書的頁數 11（不是範本《太上感應篇》的 13）', () => {
    expect(parseRoute('#/ch/11')).toEqual({ name: 'ch', no: 11, route: 'ch/11' });
    expect(parseRoute('#/ch/12')).toEqual({ name: 'cover', route: '' });
    expect(parseRoute('#/ch/13')).toEqual({ name: 'cover', route: '' });
  });
});

describe('toHash', () => {
  it('路由轉成 hash', () => {
    expect(toHash('')).toBe('#/');
    expect(toHash('ch/3')).toBe('#/ch/3');
    expect(toHash('daily')).toBe('#/daily');
  });
  it('和 parseRoute 來回一致', () => {
    for (const r of ['', 'toc', 'ch/1', 'ch/11', 'match', 'land', 'daily', 'about']) {
      expect(parseRoute(toHash(r), PAGES).route).toBe(r);
    }
  });
});
