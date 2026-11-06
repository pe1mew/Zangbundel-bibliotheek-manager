# SPDX-License-Identifier: Apache-2.0
"""Bundle a subset of ES modules into one file per entry point (webappTDS TD-22).

Integrity-Policy (securityAssessment SR-13) refuses scripts without integrity metadata, and a module
loaded by `import` has none. So every entry point (the page's module script, each worker) becomes
one file without imports or exports. Used by build.py; standard library only.

The subset, and nothing else (anything else fails the build with the file and line):
    import { a, b as c } from './x.js';      import * as ns from './x.js';
    export function f() {}   export async function f() {}   export class C {}
    export const x = ...;    export let x = ...;           export var x = ...;   (one name each)
    export { a, b as c };
    new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })   (bundled separately)
Relative specifiers only; no default exports, re-exports, dynamic import(), other import.meta uses
or import cycles. An imported binding is a copy taken when the importing module starts.

Each module becomes a function scope whose exports are returned as a frozen object; modules run in
dependency order, as ES modules do.
"""
import os
import posixpath
import re

IDENT = re.compile(r'[A-Za-z_$][\w$]*')
REGEX_AFTER_PUNCT = set('(,=:[!&|?{};+-*%<>~^')
REGEX_AFTER_WORD = {'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
                    'case', 'do', 'else', 'yield', 'await'}


class BundleError(Exception):
    pass


def tokenize(src, path):
    """Significant tokens as (kind, value, start, end, depth): kind is 'id', 'str', 'num' or 'p'
    (punctuator). Comments, template literals and regex literals are skipped, but their positions
    are respected, so 'import' inside them is never mistaken for a statement."""
    toks, i, n, depth = [], 0, len(src), 0
    stack = []                      # template nesting: brace depth at which each ${ ... } closes

    def line(pos):
        return src.count('\n', 0, pos) + 1

    def prev_allows_regex():
        if not toks:
            return True
        k, v = toks[-1][0], toks[-1][1]
        if k == 'p':
            return v in REGEX_AFTER_PUNCT or v == '}'
        return k == 'id' and v in REGEX_AFTER_WORD

    def skip_template(j):
        """j is just after a backtick or a closing } of ${...}; return the position after the
        closing backtick, or the position after '${' (then push)."""
        while j < n:
            c = src[j]
            if c == '\\':
                j += 2
                continue
            if c == '`':
                return j + 1, False
            if c == '$' and j + 1 < n and src[j + 1] == '{':
                return j + 2, True
            j += 1
        raise BundleError(f'{path}:{line(n)}: unterminated template literal')

    while i < n:
        c = src[i]
        if c in ' \t\r\n﻿':
            i += 1
        elif src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2)
            if j < 0:
                raise BundleError(f'{path}:{line(i)}: unterminated comment')
            i = j + 2
        elif c in '"\'':
            j = i + 1
            while j < n and src[j] != c:
                if src[j] == '\\':
                    j += 1
                elif src[j] == '\n':
                    raise BundleError(f'{path}:{line(i)}: unterminated string')
                j += 1
            if j >= n:
                raise BundleError(f'{path}:{line(i)}: unterminated string')
            toks.append(('str', src[i + 1:j], i, j + 1, depth))
            i = j + 1
        elif c == '`':
            j, opened = skip_template(i + 1)
            if opened:
                stack.append(depth)
                depth += 1
            toks.append(('p', '`', i, j, depth))
            i = j
        elif c == '}' and stack and depth - 1 == stack[-1]:
            depth -= 1
            stack.pop()
            j, opened = skip_template(i + 1)
            if opened:
                stack.append(depth)
                depth += 1
            toks.append(('p', '`', i, j, depth))
            i = j
        elif c == '/' and prev_allows_regex():
            j, in_class = i + 1, False
            while j < n:
                d = src[j]
                if d == '\\':
                    j += 2
                    continue
                if d == '\n':
                    raise BundleError(f'{path}:{line(i)}: unterminated regular expression')
                if d == '[':
                    in_class = True
                elif d == ']':
                    in_class = False
                elif d == '/' and not in_class:
                    break
                j += 1
            j += 1
            while j < n and (src[j].isalnum() or src[j] == '_'):
                j += 1
            toks.append(('re', src[i:j], i, j, depth))
            i = j
        elif c.isalpha() or c in '_$':
            m = IDENT.match(src, i)
            toks.append(('id', m.group(0), i, m.end(), depth))
            i = m.end()
        elif c.isdigit():
            m = re.compile(r'[\w.]+').match(src, i)
            toks.append(('num', m.group(0), i, m.end(), depth))
            i = m.end()
        else:
            if c in '([{':
                toks.append(('p', c, i, i + 1, depth))
                depth += 1
            elif c in ')]}':
                depth -= 1
                if depth < 0:
                    raise BundleError(f'{path}:{line(i)}: unbalanced {c}')
                toks.append(('p', c, i, i + 1, depth))
            else:
                toks.append(('p', c, i, i + 1, depth))
            i += 1
    if depth != 0 or stack:
        raise BundleError(f'{path}: unbalanced brackets at end of file')
    return toks


class Module:
    def __init__(self, path, rel):
        self.path, self.rel = path, rel
        self.imports = []      # (specifier_path, kind, bindings) kind 'named' [(imported, local)] or 'ns' local
        self.exports = []      # (exported, local)
        self.workers = []      # (start, end, absolute path) of the URL string literal
        self.edits = []        # (start, end, replacement) on the source text
        self.src = ''


def parse_module(path, rel, root):
    src = open(path, encoding='utf-8').read()
    m = Module(path, rel)
    m.src = src
    toks = tokenize(src, rel)

    def line(pos):
        return src.count('\n', 0, pos) + 1

    def fail(pos, msg):
        raise BundleError(f'{rel}:{line(pos)}: {msg} (webappTDS TD-22)')

    def resolve(spec, pos):
        if not spec.startswith(('./', '../')):
            fail(pos, f"only relative imports are allowed: '{spec}'")
        if not spec.endswith('.js'):
            fail(pos, f"import a .js file by its full name: '{spec}'")
        target = os.path.normpath(os.path.join(os.path.dirname(path), spec))
        if os.path.commonpath([root, target]) != root:
            fail(pos, f"import outside {root}: '{spec}'")
        if not os.path.isfile(target):
            fail(pos, f"no such module: '{spec}'")
        return target

    def blank(a, b):
        """Replace source[a:b] by spaces, keeping newlines, so line numbers stay the same."""
        m.edits.append((a, b, re.sub(r'[^\n]', ' ', src[a:b])))

    def tok_line(t):
        return line(t[2])

    def with_semicolon(j):
        """j is the last token of a statement; include a following ';'."""
        if j + 1 < len(toks) and toks[j + 1][0] == 'p' and toks[j + 1][1] == ';':
            return j + 1
        return j

    def declaration_end(q, s):
        """Index of the ';' ending an exported const/let/var declaration starting at token q.
        A declaration must end with ';' before the next statement keyword on a later line."""
        first = tok_line(toks[q])
        j = q
        while j < len(toks):
            t = toks[j]
            if t[0] == 'p' and t[1] == ';' and t[4] == 0:
                return j
            if t[4] == 0 and t[0] == 'id' and t[1] in ('export', 'import', 'const', 'let', 'var', 'class') \
                    and j > q and tok_line(t) > first:
                break
            j += 1
        fail(s, 'end an exported declaration with ;')

    k = 0
    while k < len(toks):
        kind, val, s, e, d = toks[k]
        prev = toks[k - 1] if k else None
        after_dot = prev is not None and prev[0] == 'p' and prev[1] == '.'
        if kind == 'id' and val == 'import' and not after_dot:
            nxt = toks[k + 1] if k + 1 < len(toks) else None
            if nxt and nxt[0] == 'p' and nxt[1] == '(':
                fail(s, 'dynamic import() is not allowed')
            if nxt and nxt[0] == 'p' and nxt[1] == '.':
                # import.meta: only as new URL('<literal>', import.meta.url) inside new Worker(...)
                ok = (k >= 4 and toks[k - 1][1] == ',' and toks[k - 2][0] == 'str' and toks[k - 3][1] == '('
                      and toks[k - 4][1] == 'URL' and k + 3 < len(toks) and toks[k + 2][1] == 'meta'
                      and toks[k + 3][1] == '.' and toks[k + 4][1] == 'url')
                ok = ok and k >= 7 and toks[k - 5][1] == 'new' and toks[k - 6][1] == '(' and toks[k - 7][1] == 'Worker'
                if not ok:
                    fail(s, "import.meta is allowed only in new Worker(new URL('./x.js', import.meta.url), ...)")
                lit = toks[k - 2]
                m.workers.append((lit[2], lit[3], resolve(lit[1], lit[2])))
                k += 5
                continue
            if d != 0:
                fail(s, 'import must be at the top level')
            fi = None
            for q in range(k + 1, min(k + 200, len(toks) - 1)):
                if toks[q][0] == 'id' and toks[q][1] == 'from' and toks[q + 1][0] == 'str':
                    fi = q - k
                    break
                if toks[q][0] == 'str' or (toks[q][0] == 'p' and toks[q][1] == ';'):
                    break
            if fi is None:
                fail(s, "import must have the form: import { a, b as c } from './x.js'; or import * as ns from './x.js';")
            j = with_semicolon(k + fi + 1)
            stmt = toks[k:j + 1]
            spec_tok = stmt[fi + 1]
            target = resolve(spec_tok[1], spec_tok[2])
            head = stmt[1:fi]
            hv = [t[1] for t in head]
            if hv[:2] == ['*', 'as'] and len(hv) == 3 and head[2][0] == 'id':
                m.imports.append((target, 'ns', hv[2]))
            elif hv and hv[0] == '{' and hv[-1] == '}':
                inner, binds = hv[1:-1], []
                for part in ' '.join(inner).split(','):
                    words = part.split()
                    if not words:
                        continue
                    if len(words) == 1 and IDENT.fullmatch(words[0]):
                        binds.append((words[0], words[0]))
                    elif len(words) == 3 and words[1] == 'as' and IDENT.fullmatch(words[0]) and IDENT.fullmatch(words[2]):
                        binds.append((words[0], words[2]))
                    else:
                        fail(s, f'cannot read import binding: {part.strip()}')
                m.imports.append((target, 'named', binds))
            else:
                fail(s, 'default imports and side-effect imports are not allowed')
            blank(s, stmt[-1][3])
            k = j + 1
            continue
        if kind == 'id' and val == 'export' and not after_dot:
            if d != 0:
                fail(s, 'export must be at the top level')
            nxt = toks[k + 1]
            if nxt[1] == 'default':
                fail(s, 'default exports are not allowed')
            if nxt[1] == '*':
                fail(s, 're-exports are not allowed')
            if nxt[1] == '{':
                close_tok = next((q for q in range(k + 2, len(toks)) if toks[q][0] == 'p' and toks[q][1] == '}'), None)
                if close_tok is None:
                    fail(s, 'unclosed export list')
                if close_tok + 1 < len(toks) and toks[close_tok + 1][1] == 'from':
                    fail(s, 're-exports are not allowed')
                j = with_semicolon(close_tok)
                stmt = toks[k:j + 1]
                vals = [t[1] for t in stmt]
                close = vals.index('}')
                for part in ' '.join(vals[2:close]).split(','):
                    words = part.split()
                    if not words:
                        continue
                    if len(words) == 1 and IDENT.fullmatch(words[0]):
                        m.exports.append((words[0], words[0]))
                    elif len(words) == 3 and words[1] == 'as':
                        m.exports.append((words[2], words[0]))
                    else:
                        fail(s, f'cannot read export: {part.strip()}')
                blank(s, stmt[-1][3])
                k = j + 1
                continue
            # export <declaration>: drop the keyword, record the name
            q = k + 1
            if toks[q][1] == 'async':
                q += 1
            decl = toks[q][1]
            if decl == 'function':
                q += 1
                if toks[q][1] == '*':
                    q += 1
                name = toks[q]
            elif decl == 'class':
                name = toks[q + 1]
            elif decl in ('const', 'let', 'var'):
                name = toks[q + 1]
                j = declaration_end(q, s)
                if any(t[0] == 'p' and t[1] == ',' and t[4] == 0 for t in toks[q:j]):
                    fail(s, f'one name per export {decl}')
            else:
                fail(s, f'cannot export this: {decl}')
            if name[0] != 'id':
                fail(s, 'exported declarations must have a simple name (no destructuring)')
            m.exports.append((name[1], name[1]))
            m.edits.append((s, toks[k + 1][2], ''))
            k += 1
            continue
        k += 1
    return m


def bundle(entry, root):
    """Return (code, workers, sources): the bundle text of one entry point, the absolute paths of
    the worker entry points it starts (their URLs are placeholders until place_workers), and the
    absolute paths of every module in the bundle."""
    root = os.path.abspath(root)
    modules, order, state = {}, [], {}

    def visit(path, chain):
        if state.get(path) == 'done':
            return
        if state.get(path) == 'busy':
            raise BundleError('import cycle: ' + ' -> '.join(os.path.relpath(p, root).replace(os.sep, '/') for p in chain + [path]))
        state[path] = 'busy'
        rel = os.path.relpath(path, root).replace(os.sep, '/')
        m = parse_module(path, rel, root)
        modules[path] = m
        for dep, _, _ in m.imports:
            visit(dep, chain + [path])
        state[path] = 'done'
        order.append(path)

    visit(os.path.abspath(entry), [])
    ids = {p: i for i, p in enumerate(order)}
    out = ['// Bundled by webapp/tools/build.py (webappTDS TD-22). Sources: '
           + ', '.join(modules[p].rel for p in order) + '\n']
    workers = []
    for p in order:
        m = modules[p]
        exported = {e for e, _ in m.exports}
        if len(exported) != len(m.exports):
            raise BundleError(f'{m.rel}: a name is exported twice')
        lines = []
        for dep, kind, binds in m.imports:
            dm, var = modules[dep], f'__zbm_m{ids[dep]}'
            if kind == 'ns':
                lines.append(f'const {binds} = {var};')
            else:
                have = {e for e, _ in dm.exports}
                for imported, _ in binds:
                    if imported not in have:
                        raise BundleError(f"{m.rel}: '{imported}' is not exported by {dm.rel}")
                lines.append('const { ' + ', '.join(i if i == l else f'{i}: {l}' for i, l in binds) + f' }} = {var};')
        text = m.src
        edits = list(m.edits)
        for a, b, target in m.workers:
            workers.append(target)
            edits.append((a, b, "'\0WORKER:" + target + "\0'"))
        for a, b, rep in sorted(edits, key=lambda e: e[0], reverse=True):
            text = text[:a] + rep + text[b:]
        ret = ', '.join(e if e == l else f'{e}: {l}' for e, l in m.exports)
        out.append(f'// ---- {m.rel}\nconst __zbm_m{ids[p]} = (() => {{\n'
                   + ''.join(l + '\n' for l in lines) + text.rstrip('\n')
                   + f'\nreturn Object.freeze({{ {ret} }});\n}})();\n')
    return ''.join(out), workers, list(order)


def place_workers(code, names):
    """Replace the worker placeholders with the bundles' file names (same folder as the bundle)."""
    def sub(mt):
        return "'./" + names[mt.group(1)] + "'"
    return re.sub(r"'\x00WORKER:(.*?)\x00'", sub, code)
