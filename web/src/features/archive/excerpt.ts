/** Collapses line breaks so a post reads as one paragraph in a table cell. */
export const excerpt = (text: string) => text.replace(/\s+/g, ' ').trim();
