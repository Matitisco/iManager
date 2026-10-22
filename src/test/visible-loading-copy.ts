import ts from 'typescript';

const loadingCopy = /\b(?:cargando|loading)\b/i;
const nonvisualProps = /^(?:aria-|data-|className$|testId$|key$|id$|role$|type$)/;

/** Inspect literals, including copy declared outside JSX and passed to a child later. */
export function visibleLoadingCopy(source: string): string[] {
  const file = ts.createSourceFile('screen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  function hidden(node: ts.Node): boolean {
    for (let parent: ts.Node | undefined = node; parent; parent = parent.parent) {
      if (ts.isJsxAttribute(parent) && nonvisualProps.test(parent.name.getText(file))) return true;
      if (ts.isJsxElement(parent)) {
        const attributes = parent.openingElement.attributes.properties;
        if (attributes.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(file) === 'className' && /\bsr-only\b/.test(attr.initializer?.getText(file) ?? ''))) return true;
      }
    }
    return false;
  }
  function rendered(node: ts.Node): boolean {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isJsxExpression(parent) || ts.isJsxAttribute(parent)) return true;
    if (ts.isConditionalExpression(parent)) return node !== parent.condition && rendered(parent);
    if (ts.isBinaryExpression(parent)) return [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind) && rendered(parent);
    if (ts.isParenthesizedExpression(parent)) return rendered(parent);
    return false;
  }
  function visit(node: ts.Node) {
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = node.text.trim();
      // A lowercase state discriminant is legitimate outside rendered expressions.
      const state = text === 'loading' && !rendered(node);
      if (!state && loadingCopy.test(text) && !hidden(node)) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        hits.push(`${line}: ${text}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return hits;
}
