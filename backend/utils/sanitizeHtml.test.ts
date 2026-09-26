import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

/** Allowed formatting passes through unchanged. */
describe('sanitizeHtml — allowlist keeps', () => {
    it('keeps safe formatting tags and their inner text', () => {
        expect(sanitizeHtml('<p>Hello <strong>world</strong></p>')).toBe(
            '<p>Hello <strong>world</strong></p>',
        );
    });

    it('keeps an <ul>/<li> list', () => {
        expect(sanitizeHtml('<ul><li>a</li><li>b</li></ul>')).toBe('<ul><li>a</li><li>b</li></ul>');
    });

    it('keeps https links and relative/src URLs', () => {
        expect(sanitizeHtml('<a href="https://ok.com">ok</a>')).toBe('<a href="https://ok.com">ok</a>');
        expect(sanitizeHtml('<img src="/uploads/p.png">')).toBe('<img src="/uploads/p.png">');
    });
});

/** Dangerous constructs are stripped even when nesting obfuscation is attempted. */
describe('sanitizeHtml — dangerous stripped', () => {
    it('strips <script> blocks entirely', () => {
        expect(sanitizeHtml('<p>x</p><script>alert(1)</script>')).toBe('<p>x</p>');
    });

    it('strips <style> blocks entirely', () => {
        expect(sanitizeHtml('a<style>body{display:none}</style>b')).toBe('ab');
    });

    it('drops event-handler attributes', () => {
        expect(sanitizeHtml('<p onclick="evil()">x</p>')).toBe('<p>x</p>');
    });

    it('drops onerror on <img>', () => {
        expect(sanitizeHtml('<img src="/a.png" onerror="alert(1)">')).toBe('<img src="/a.png">');
    });

    it('drops inline style / srcdoc', () => {
        expect(sanitizeHtml('<p style="display:none">h</p>')).toBe('<p>h</p>');
        expect(sanitizeHtml('<iframe srcdoc="x"></iframe>')).toBe('');
        // non-allowlisted tags (div/iframe) are dropped along with their attrs
        expect(sanitizeHtml('<div style="display:none">h</div>')).toBe('h');
    });

    it('neutralizes javascript: in href and src', () => {
        expect(sanitizeHtml('<a href="javascript:alert(1)">c</a>')).toBe('<a>c</a>');
        expect(sanitizeHtml('<a href="java\nscript:alert(1)">c</a>')).toBe('<a>c</a>');
    });

    it('drops non-allowlisted tags but keeps inner text', () => {
        expect(sanitizeHtml('<iframe src="x"></iframe><marquee>m</marquee>')).toBe('m');
    });

    it('returns empty string for null/undefined', () => {
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
    });
});