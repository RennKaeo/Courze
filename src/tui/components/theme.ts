import blessed from 'blessed'

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  error: string
  warning: string
  success: string
  info: string
  text: string
  textMuted: string
  background: string
  backgroundPanel: string
  border: string
  borderActive: string
}

export class Theme {
  current: ThemeColors = {
    primary: 'cyan',
    secondary: 'blue',
    accent: 'magenta',
    error: 'red',
    warning: 'yellow',
    success: 'green',
    info: 'cyan',
    text: 'white',
    textMuted: 'gray',
    background: 'black',
    backgroundPanel: 'black',
    border: 'gray',
    borderActive: 'cyan',
  }
}

export function styled(st: TemplateStringsArray, ...vals: string[]): string {
  let out = ''
  for (let i = 0; i < st.length; i++) {
    out += st[i]
    if (i < vals.length) out += vals[i]
  }
  return out
}
