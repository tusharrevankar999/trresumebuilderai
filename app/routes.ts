import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route('/auth', 'routes/auth.tsx'),
    route('/upload', 'routes/upload.tsx'),
    route('/builder', 'routes/builder.tsx'),
    route('/resume/:id', 'routes/resume.tsx'),
    route('/cover-letter', 'routes/cover-letter.tsx'),
    route('/wipe', 'routes/wipe.tsx'),
    route('/api/ai', 'routes/api.ai.ts'),
] satisfies RouteConfig;
