import { mount } from 'svelte';
import App from './App.svelte';
import 'xterm/css/xterm.css';
import './styles.css';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;