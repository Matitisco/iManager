import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { authActionHref, readAuthAction, type AuthActionLocation } from './auth-action-url';
import { useAuthActionLink } from './use-auth-action';

const ORIGIN = 'https://hifi-desk-production.up.railway.app';

function loc(href: string): AuthActionLocation {
  const url = new URL(href, ORIGIN);
  return { pathname: url.pathname, search: url.search, hash: url.hash };
}

describe('readAuthAction', () => {
  it('reads a firebase query that was appended inside the hash route', () => {
    expect(readAuthAction(loc(`${ORIGIN}/#/restablecer?mode=resetPassword&oobCode=abc&apiKey=key&lang=es`))).toEqual({
      mode: 'resetPassword',
      oobCode: 'abc',
      apiKey: 'key',
      continueUrl: null,
      lang: 'es',
    });
  });

  it('reads the same params from location.search when the action url has no hash', () => {
    expect(readAuthAction(loc(`${ORIGIN}/?mode=resetPassword&oobCode=abc&apiKey=key`))).toMatchObject({
      mode: 'resetPassword',
      oobCode: 'abc',
      apiKey: 'key',
    });
  });

  it('prefers the code carried in the hash when search also has one', () => {
    const link = readAuthAction(
      loc(`${ORIGIN}/?mode=resetPassword&oobCode=from-search#/restablecer?mode=resetPassword&oobCode=from-hash`),
    );
    expect(link?.oobCode).toBe('from-hash');
  });

  it('recognizes verifyEmail and recoverEmail', () => {
    expect(readAuthAction(loc(`${ORIGIN}/?mode=verifyEmail&oobCode=mail`))?.mode).toBe('verifyEmail');
    expect(readAuthAction(loc(`${ORIGIN}/?mode=recoverEmail&oobCode=mail`))?.mode).toBe('recoverEmail');
  });

  it('treats the internal route without a code as an action screen', () => {
    expect(readAuthAction(loc(`${ORIGIN}/#/restablecer`))).toMatchObject({ mode: '', oobCode: '' });
  });

  it('ignores ordinary app urls', () => {
    expect(readAuthAction(loc(`${ORIGIN}/#/dash`))).toBeNull();
    expect(readAuthAction(loc(`${ORIGIN}/?foo=1`))).toBeNull();
  });
});

describe('authActionHref', () => {
  it('moves a search-string action into the hash route and drops those params from the query', () => {
    expect(authActionHref(loc(`${ORIGIN}/?mode=resetPassword&oobCode=abc&apiKey=key#/dash`))).toBe(
      '/#/restablecer?mode=resetPassword&oobCode=abc&apiKey=key',
    );
  });

  it('keeps unrelated query params', () => {
    expect(authActionHref(loc(`${ORIGIN}/?store=1&mode=verifyEmail&oobCode=mail`))).toBe(
      '/?store=1#/restablecer?mode=verifyEmail&oobCode=mail',
    );
  });

  it('leaves an already normalized hash url unchanged', () => {
    const href = '/#/restablecer?mode=resetPassword&oobCode=abc&apiKey=key';
    expect(authActionHref(loc(`${ORIGIN}${href}`))).toBe(href);
  });
});

describe('useAuthActionLink', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('rewrites a firebase search url to the internal route', () => {
    window.history.replaceState(null, '', '/?mode=resetPassword&oobCode=abc&apiKey=key&lang=es');
    const { result } = renderHook(() => useAuthActionLink());

    expect(result.current.link).toMatchObject({ mode: 'resetPassword', oobCode: 'abc', apiKey: 'key', lang: 'es' });
    expect(window.location.pathname).toBe('/');
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#/restablecer?mode=resetPassword&oobCode=abc&apiKey=key&lang=es');
  });

  it('clears the action url when the flow is dismissed', () => {
    window.history.replaceState(null, '', '/?keep=1&mode=resetPassword&oobCode=abc');
    const { result } = renderHook(() => useAuthActionLink());

    act(() => result.current.dismiss());

    expect(result.current.link).toBeNull();
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('oobCode');
  });

  it('picks up a hash change that arrives after load', () => {
    window.history.replaceState(null, '', '/');
    const { result } = renderHook(() => useAuthActionLink());
    expect(result.current.link).toBeNull();

    act(() => {
      window.history.pushState(null, '', '/#/restablecer?mode=recoverEmail&oobCode=mail-code');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current.link).toMatchObject({ mode: 'recoverEmail', oobCode: 'mail-code' });
  });
});
