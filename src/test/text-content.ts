/** Match visible copy split by inline value annotations, without matching its ancestors. */
export function textContent(expected: string | RegExp) {
  const matches = (element: Element) => {
    const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return typeof expected === 'string' ? text === expected : expected.test(text);
  };
  return (_content: string, element: Element | null) => Boolean(element && matches(element)
    && !Array.from(element.children).some(matches));
}
