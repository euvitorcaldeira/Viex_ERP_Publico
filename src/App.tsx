import Application from './v4/Application';
import LocalEntry from './LocalEntry';
export default function App(){return typeof __DALEX_LOCAL__!=='undefined'&&__DALEX_LOCAL__?<LocalEntry/>:<Application/>}
