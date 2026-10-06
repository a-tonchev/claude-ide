import React, { forwardRef } from 'react';
import Box from '@mui/material/Box';
import {
  ArrowBigUpDash, ArrowUp, Bookmark, BookmarkCheck, BookmarkMinus, Bot, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Circle, CircleAlert, CircleCheck, CircleUser, Code,
  Copy, EllipsisVertical, ExternalLink, Eye, EyeOff, File, FileText, FileUp, Folder, FolderInput, FolderOpen,
  FolderPlus, Globe, Hexagon, History, House, Info, KeyRound, LayoutTemplate, ListChecks, ListX, Lock, Mail,
  Maximize2, Menu, MessageSquare, Minus, Monitor, Move, Paperclip, Pencil, Play, Plus, RefreshCw, Rocket,
  RotateCcw, Save, Search, Settings, SlidersHorizontal, Square, SquareTerminal, Bell, Trash2, TriangleAlert, Tv,
  User, UserCog, X, AppWindow,
} from 'lucide-react';

// Lucide icons with the MUI SvgIcon API the app was written against: 1em square, sized by
// sx fontSize or fontSize="small|medium|large|inherit", coloured by sx color or a palette
// name in `color`. `size` (a number) also works, as with the Phosphor icons they replace.
// filled: the shape is filled with its colour (a saved bookmark, a status dot).

const FONT_SIZES = {
  inherit: 'inherit', small: '1.25rem', medium: '1.5rem', large: '2.1875rem',
};

const PALETTE_COLORS = {
  primary: 'primary.main',
  secondary: 'secondary.main',
  error: 'error.main',
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  action: 'action.active',
  disabled: 'action.disabled',
  inherit: undefined,
};

const toColor = color => (color in PALETTE_COLORS ? PALETTE_COLORS[color] : color);

const lucide = (Icon, { filled: filledByDefault = false } = {}) => {
  const Wrapped = forwardRef(({
    sx, fontSize, size, color, weight, filled = filledByDefault, titleAccess, ...rest
  }, ref) => (
    <Box
      component={Icon}
      ref={ref}
      aria-hidden={titleAccess ? undefined : true}
      aria-label={titleAccess}
      role={titleAccess ? 'img' : undefined}
      {...rest}
      fill={filled ? 'currentColor' : 'none'}
      sx={[
        {
          width: '1em',
          height: '1em',
          flexShrink: 0,
          display: 'inline-block',
          verticalAlign: 'middle',
          fontSize: size ?? FONT_SIZES[fontSize] ?? fontSize ?? '1.5rem',
          color: color ? toColor(color) : undefined,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  ));
  Wrapped.displayName = `Lucide${Icon.displayName || ''}`;
  return Wrapped;
};

// Named after the MUI (and Phosphor) icons they replaced
export const AccountCircleIcon = lucide(CircleUser);
export const AddIcon = lucide(Plus);
export const ArrowDropDownIcon = lucide(ChevronDown);
export const ArrowFatLinesUpIcon = lucide(ArrowBigUpDash);
export const ArrowUpwardIcon = lucide(ArrowUp);
export const ArrowsOutIcon = lucide(Maximize2);
export const ArticleIcon = lucide(FileText);
export const AttachFileIcon = lucide(Paperclip);
export const AutoAwesomeIcon = lucide(Bot);
export const BallotIcon = lucide(ListChecks);
export const BookmarkBorderIcon = lucide(Bookmark);
export const BookmarkIcon = lucide(Bookmark, { filled: true });
export const BookmarkRemoveOutlinedIcon = lucide(BookmarkMinus);
export const BookmarksOutlinedIcon = lucide(BookmarkCheck);
export const ChatIcon = lucide(MessageSquare);
export const CheckCircleIcon = lucide(CircleCheck);
export const CheckIcon = lucide(Check);
export const ChevronLeftIcon = lucide(ChevronLeft);
export const ChevronRightIcon = lucide(ChevronRight);
export const CloseIcon = lucide(X);
export const CodeIcon = lucide(Code);
export const ContentCopyIcon = lucide(Copy);
export const DeleteIcon = lucide(Trash2);
export const DeleteOutlineIcon = lucide(Trash2);
export const DeleteSweepIcon = lucide(ListX);
export const DescriptionIcon = lucide(FileText);
export const DoneIcon = lucide(Check);
export const DriveFileMoveOutlinedIcon = lucide(FolderInput);
export const EditIcon = lucide(Pencil);
export const ErrorIcon = lucide(CircleAlert);
export const ErrorOutlineIcon = lucide(CircleAlert);
export const ExpandLessIcon = lucide(ChevronUp);
export const ExpandMoreIcon = lucide(ChevronDown);
export const FiberManualRecordIcon = lucide(Circle, { filled: true });
export const FolderIcon = lucide(Folder);
export const FolderOpenIcon = lucide(FolderOpen);
export const FolderOutlinedIcon = lucide(Folder);
export const GroupAddIcon = lucide(FolderPlus);
export const HexagonOutlinedIcon = lucide(Hexagon);
export const HistoryIcon = lucide(History);
export const HomeIcon = lucide(House);
export const InfoIcon = lucide(Info);
export const InsertDriveFileOutlinedIcon = lucide(File);
export const KeyIcon = lucide(KeyRound);
export const KeyboardArrowDownIcon = lucide(ChevronDown);
export const KeyboardArrowLeftIcon = lucide(ChevronLeft);
export const KeyboardArrowRightIcon = lucide(ChevronRight);
export const KeyboardArrowUpIcon = lucide(ChevronUp);
export const LanguageIcon = lucide(Globe);
export const LockOutlinedIcon = lucide(Lock);
export const MailIcon = lucide(Mail);
export const MenuIcon = lucide(Menu);
export const MinimizeIcon = lucide(Minus);
export const MonitorIcon = lucide(Monitor);
export const MoreVertIcon = lucide(EllipsisVertical);
export const NotificationsIcon = lucide(Bell);
export const OpenInNewIcon = lucide(ExternalLink);
export const OpenWithIcon = lucide(Move);
export const PersonIcon = lucide(User);
export const PlayArrowIcon = lucide(Play);
export const RefreshIcon = lucide(RefreshCw);
export const RestoreIcon = lucide(RotateCcw);
export const RocketLaunchIcon = lucide(Rocket);
export const SaveIcon = lucide(Save);
export const SearchIcon = lucide(Search);
export const SettingsIcon = lucide(Settings);
export const SmartToyIcon = lucide(Bot);
export const StopIcon = lucide(Square);
export const SupervisorAccountIcon = lucide(UserCog);
export const TerminalIcon = lucide(SquareTerminal);
export const TuneIcon = lucide(SlidersHorizontal);
export const TvIcon = lucide(Tv);
export const UnfoldLessIcon = lucide(ChevronsDownUp);
export const UnfoldMoreIcon = lucide(ChevronsUpDown);
export const UploadFileIcon = lucide(FileUp);
export const VisibilityIcon = lucide(Eye);
export const VisibilityOffIcon = lucide(EyeOff);
export const WarningAmberRoundedIcon = lucide(TriangleAlert);
export const WebAssetIcon = lucide(AppWindow);
export const WebIcon = lucide(LayoutTemplate);
