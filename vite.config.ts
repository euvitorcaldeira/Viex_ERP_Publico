import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({ plugins: [react()],define:{__DALEX_DEMO__:JSON.stringify(mode==='demo'),__DALEX_LOCAL__:JSON.stringify(mode!=='demo'&&mode!=='test')} }));
