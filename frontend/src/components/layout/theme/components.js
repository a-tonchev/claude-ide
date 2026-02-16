const components = {
  MuiLink: {
    defaultProps: {
      underline: 'none',
    },
  },
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: '#2B2B2B',
        color: '#A9B7C6',
      },
      '::-webkit-scrollbar': {
        width: 8,
        height: 8,
      },
      '::-webkit-scrollbar-track': {
        background: '#313335',
      },
      '::-webkit-scrollbar-thumb': {
        background: '#4E5254',
        borderRadius: 4,
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: '#606366',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
      },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: {
        backgroundColor: '#313335',
        backgroundImage: 'none',
        border: '1px solid #4E5254',
      },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: '#313335',
        backgroundImage: 'none',
        border: '1px solid #4E5254',
        borderRadius: 12,
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: '#4E5254',
          },
          '&:hover fieldset': {
            borderColor: '#808080',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#6897BB',
          },
        },
        '& .MuiInputLabel-root': {
          color: '#808080',
        },
        '& .MuiInputBase-input': {
          color: '#A9B7C6',
        },
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      contained: {
        backgroundColor: '#214283',
        color: '#A9B7C6',
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: '#2E5AA7',
          boxShadow: 'none',
        },
      },
      outlined: {
        borderColor: '#4E5254',
        color: '#A9B7C6',
        '&:hover': {
          borderColor: '#808080',
          backgroundColor: 'rgba(104,151,187,0.1)',
        },
      },
      text: {
        color: '#808080',
        '&:hover': {
          backgroundColor: 'rgba(104,151,187,0.1)',
        },
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontWeight: 500,
      },
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        '&:hover': {
          backgroundColor: 'rgba(104,151,187,0.1)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(33,66,131,0.3)',
          '&:hover': {
            backgroundColor: 'rgba(33,66,131,0.4)',
          },
        },
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: '#3C3F41',
      },
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: {
        color: '#808080',
        '&:hover': {
          backgroundColor: 'rgba(104,151,187,0.15)',
          color: '#A9B7C6',
        },
      },
    },
  },
};

export default components;
