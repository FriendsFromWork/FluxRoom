import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';

export { CODE_LANGUAGES, type CodeLanguage } from './codeLanguageList';

export function getLanguageExtension(lang: string): Extension[] {
  switch (lang) {
    case 'javascript':
      return [javascript({ jsx: false })];
    case 'typescript':
      return [javascript({ jsx: false, typescript: true })];
    case 'jsx':
      return [javascript({ jsx: true, typescript: true })];
    case 'python':
      return [python()];
    case 'html':
      return [html()];
    case 'css':
      return [css()];
    case 'json':
      return [json()];
    case 'markdown':
      return [markdown()];
    default:
      return [];
  }
}
