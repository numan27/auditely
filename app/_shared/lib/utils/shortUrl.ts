// app/_shared/lib/utils/shortUrl.ts

/** A website the way people write it: no scheme, no "www.", no trailing slash */
export const shortUrl = (website: string): string => website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
