// 테스트 파일 목록.
// UNIT_TESTS: DOM 없이 돌아가서 노드와 브라우저(tests/index.html) 양쪽에서 돈다.
// NODE_TESTS: 파일을 직접 읽어서 노드에서만 돈다.
// DOM_TESTS: 브라우저 전용.
export const UNIT_TESTS = ['./html.test.js', './calc.test.js', './app.test.js', './curriculum.test.js'];
export const NODE_TESTS = ['./sw.node.test.js', './motion.node.test.js', './sync.node.test.js'];
export const DOM_TESTS = ['./ui.dom.test.js'];
