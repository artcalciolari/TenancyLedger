const tsJest = require('ts-jest').default.createTransformer();

const ignoreGeneratedDecoratorMetadata = (code) => {
  let transformed = '';
  let cursor = 0;

  while (true) {
    const metadataStart = code.indexOf('__metadata(', cursor);
    if (metadataStart === -1) return transformed + code.slice(cursor);

    transformed += code.slice(cursor, metadataStart);
    let depth = 0;
    let quote;
    let escaped = false;
    let metadataEnd = metadataStart;

    for (; metadataEnd < code.length; metadataEnd += 1) {
      const character = code[metadataEnd];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') {
        quote = character;
      } else if (character === '(') {
        depth += 1;
      } else if (character === ')' && --depth === 0) {
        metadataEnd += 1;
        break;
      }
    }

    const metadataCall = code
      .slice(metadataStart, metadataEnd)
      .replaceAll('typeof ', '/* istanbul ignore next */ typeof ');
    transformed += `/* istanbul ignore next */ ${metadataCall}`;
    cursor = metadataEnd;
  }
};

module.exports = {
  ...tsJest,
  process(sourceText, sourcePath, transformOptions) {
    const result = tsJest.process(sourceText, sourcePath, transformOptions);
    if (typeof result === 'string') {
      return ignoreGeneratedDecoratorMetadata(result);
    }
    return {
      ...result,
      code: ignoreGeneratedDecoratorMetadata(result.code),
    };
  },
  getCacheKey(...args) {
    return `${tsJest.getCacheKey(...args)}:ignore-generated-decorator-metadata-v3`;
  },
};
