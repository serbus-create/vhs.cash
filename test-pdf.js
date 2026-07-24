const { renderToBuffer, Document, Page, Text, Font, StyleSheet } = require('@react-pdf/renderer');
const React = require('react');
const path = require('path');
const fs = require('fs');

const fontPath = path.join(__dirname, 'public/fonts/dejavu.ttf');
console.log('Font exists:', fs.existsSync(fontPath));
console.log('Font size:', fs.statSync(fontPath).size);

Font.register({
  family: 'DejaVu',
  src: fontPath,
});

const styles = StyleSheet.create({
  page: { padding: 20 },
  text: { fontFamily: 'DejaVu', fontSize: 12 },
});

const TestDoc = () => React.createElement(Document, null,
  React.createElement(Page, { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.text }, 'Test: ěščřžáíýúů')
  )
);

renderToBuffer(React.createElement(TestDoc)).then(buf => {
  fs.writeFileSync('test-output.pdf', buf);
  console.log('SUCCESS! PDF created, size:', buf.length);
}).catch(err => {
  console.error('ERROR:', err.message);
});
