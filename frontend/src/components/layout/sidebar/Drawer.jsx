import { useState } from 'react';
import {
  Drawer as MuiDrawer,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';

import { MenuIcon } from '@/components/Icons/Icons';
import useClasses from '@/components/layout/hooks/useClasses';

import Sidebar from './Sidebar';

const styles = {
  list: {
    width: 250,
  },
};

const Drawer = () => {
  const classes = useClasses(styles);
  const [open, setOpen] = useState(false);

  const toggleDrawer = openDrawer => event => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setOpen(openDrawer);
  };

  return (
    <div>
      <MuiDrawer anchor="left" open={open} onClose={toggleDrawer(false)}>
        <div
          className={classes.list}
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <Sidebar />
        </div>
      </MuiDrawer>
      <IconButton
        edge="start"
        className={classes.menuButton}
        color="inherit"
        aria-label="open drawer"
        onClick={toggleDrawer(true)}
        size="large"
      >
        <MenuIcon />
      </IconButton>
    </div>
  );
};

export default Drawer;
