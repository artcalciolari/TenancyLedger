import BrightnessAutoOutlinedIcon from '@mui/icons-material/BrightnessAutoOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { useThemePreference, type ThemePreference } from '../../app/theme/ThemePreferenceContext';

const options: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'Usar tema do sistema', icon: <BrightnessAutoOutlinedIcon /> },
  { value: 'light', label: 'Tema claro', icon: <LightModeOutlinedIcon /> },
  { value: 'dark', label: 'Tema escuro', icon: <DarkModeOutlinedIcon /> },
];

function preferenceIcon(preference: ThemePreference): ReactNode {
  return options.find((option) => option.value === preference)?.icon;
}

export function ThemePreferenceMenu() {
  const { preference, setPreference } = useThemePreference();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const openMenu = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const closeMenu = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Aparência">
        <IconButton
          aria-label="Escolher aparência"
          aria-controls={anchor ? 'theme-preference-menu' : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          aria-haspopup="menu"
          onClick={openMenu}
        >
          {preferenceIcon(preference)}
        </IconButton>
      </Tooltip>
      <Menu id="theme-preference-menu" anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            role="menuitemradio"
            aria-checked={preference === option.value}
            selected={preference === option.value}
            onClick={() => {
              setPreference(option.value);
              closeMenu();
            }}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
