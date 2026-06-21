export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                fetch: "readonly",
                console: "readonly",
                alert: "readonly",
                L: "readonly",
                setTimeout: "readonly",
                parseInt: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error"
        }
    }
];
