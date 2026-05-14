import Cookies from 'js-cookie';

// Cookie utilities
export const setCookie = (name: string, value: string, days = 7) => {
  Cookies.set(name, value, { expires: days, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
};

export const getCookie = (name: string) => {
  return Cookies.get(name);
};

export const removeCookie = (name: string) => {
  Cookies.remove(name);
};

