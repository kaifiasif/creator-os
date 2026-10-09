/** Text edits on a draft's posts, applied the way the server will read them back. */
const tidy = (text: string) => text.replace(/\s{2,}/g, ' ').trim();

/** Replaces the first occurrence of `sentence` in the posts. An empty replacement removes it. */
export function replaceSentence(posts: string[], sentence: string, replacement: string): string[] {
  let done = false;
  return posts.map((post) => {
    if (done || !post.includes(sentence)) return post;
    done = true;
    return tidy(post.replace(sentence, () => replacement));
  });
}

export const cleanPosts = (posts: string[]) => posts.map((p) => p.trim()).filter(Boolean);

export const samePosts = (a: string[], b: string[]) => cleanPosts(a).join('\n\n') === cleanPosts(b).join('\n\n');
