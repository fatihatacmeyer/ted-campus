// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // PrimeNG pButton içeriği [label] girdisinden üretir; derleme zamanında boş görünür.
      // Checkbox/select bileşenini saran <label> ilişkili kontrol sayılsın.
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        { controlComponents: ['p-checkbox', 'p-select', 'p-multiselect'] },
      ],
      '@angular-eslint/template/elements-content': [
        'error',
        { allowList: ['aria-label', 'innerHTML', 'outerHTML', 'innerText', 'textContent', 'label'] },
      ],
    },
  },
]);
