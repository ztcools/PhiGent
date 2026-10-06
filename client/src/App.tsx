import { StyledEngineProvider } from '@mui/material';
import Router from './router/Router';
import {
  RootProvider,
  NavProvider,
  SessionProvider,
  ColorModeProvider,
} from './context';

function App() {
  return (
    <StyledEngineProvider injectFirst>
      <ColorModeProvider>
        <SessionProvider>
          <RootProvider>
            <NavProvider>
              <Router></Router>
            </NavProvider>
          </RootProvider>
        </SessionProvider>
      </ColorModeProvider>
    </StyledEngineProvider>
  );
}

export default App;
