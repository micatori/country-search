/**
 * The only place allowed to touch DOM creation primitives. Every UI module builds nodes through
 * these helpers, which is how the project keeps the "no innerHTML for dynamic content" rule:
 * text always goes through textContent, so an API-provided country name can never be parsed
 * as markup.
 */
export type TagName = keyof HTMLElementTagNameMap;

export interface ElementInit {
  readonly id?: string;
  readonly class?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly dataset?: Readonly<Record<string, string>>;
  readonly children?: readonly Node[];
}

export function createElement<K extends TagName>(tag: K, init: ElementInit = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (init.id !== undefined) {
    node.id = init.id;
  }
  if (init.class !== undefined) {
    node.className = init.class;
  }
  if (init.text !== undefined) {
    node.textContent = init.text;
  }
  if (init.attributes !== undefined) {
    for (const [name, value] of Object.entries(init.attributes)) {
      node.setAttribute(name, value);
    }
  }
  if (init.dataset !== undefined) {
    for (const [name, value] of Object.entries(init.dataset)) {
      node.dataset[name] = value;
    }
  }
  if (init.children !== undefined) {
    node.replaceChildren(...init.children);
  }

  return node;
}

/**
 * ParentNode (not Node) is the type that actually declares replaceChildren — every container
 * the UI renders into is an element, so the narrower type costs nothing and keeps the call legal.
 */
export function replaceContent(target: ParentNode, children: readonly Node[]): void {
  target.replaceChildren(...children);
}

export function clearContent(target: ParentNode): void {
  target.replaceChildren();
}

export function toggleHidden(node: HTMLElement, hidden: boolean): void {
  node.hidden = hidden;
}
