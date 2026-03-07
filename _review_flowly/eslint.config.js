module.exports = [
  {
    files: ['js/app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
        location: 'readonly',
        lucide: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        Intl: 'readonly',
        Date: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        JSON: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['js/**/*.js'],
    ignores: ['js/app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        navigator: 'readonly',
        Notification: 'readonly',
        location: 'readonly',
        lucide: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        Intl: 'readonly',
        Date: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        JSON: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  }
];
