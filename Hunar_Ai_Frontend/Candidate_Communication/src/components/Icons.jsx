import React from 'react';
import {
  FiPlus,
  FiTrash2,
  FiSearch,
  FiFilter,
  FiCheck,
  FiAlertCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiX,
  FiArrowUp,
  FiArrowDown,
  FiPhone,
  FiMail,
  FiClock,
  FiRefreshCw,
  FiUser
} from 'react-icons/fi';
import { IoSend } from 'react-icons/io5';

// Re-export standard icons imported from react-icons
export const PlusIcon = ({
  size = 16, className = ''
}) =>
  <FiPlus size={size}
    className={className} />;
export const TrashIcon = ({ size = 15, className = '' }) => <FiTrash2 size={size} className={className} />;
export const SendIcon = ({ size = 15, className = '' }) => <IoSend size={size} className={className} />;
export const SearchIcon = ({ size = 15, className = '' }) => <FiSearch size={size} className={className} />;
export const FilterIcon = ({ size = 14, className = '' }) => <FiFilter size={size} className={className} />;
export const CheckIcon = ({ size = 13, className = '' }) => <FiCheck size={size} className={className} />;
export const FailedIcon = ({ size = 13, className = '' }) => <FiAlertCircle size={size} className={className} />;
export const ChevronDownIcon = ({ size = 14, className = '' }) => <FiChevronDown size={size} className={className} />;
export const ChevronsLeftIcon = ({ size = 16, className = '' }) => <FiChevronsLeft size={size} className={className} />;
export const ChevronLeftIcon = ({ size = 16, className = '' }) => <FiChevronLeft size={size} className={className} />;
export const ChevronRightIcon = ({ size = 16, className = '' }) => <FiChevronRight size={size} className={className} />;
export const ChevronsRightIcon = ({ size = 16, className = '' }) => <FiChevronsRight size={size} className={className} />;
export const CloseIcon = ({ size = 18, className = '' }) => <FiX size={size} className={className} />;
export const SortAscIcon = ({ size = 14, className = '' }) => <FiArrowUp size={size} className={className} />;
export const SortDescIcon = ({ size = 14, className = '' }) => <FiArrowDown size={size} className={className} />;
export const PhoneIcon = ({ size = 15, className = '' }) => <FiPhone size={size} className={className} />;
export const MailIcon = ({ size = 15, className = '' }) => <FiMail size={size} className={className} />;
export const ClockIcon = ({ size = 15, className = '' }) => <FiClock size={size} className={className} />;
export const RefreshIcon = ({ size = 15, className = '' }) => <FiRefreshCw size={size} className={className} />;
export const UserIcon = ({ size = 15, className = '' }) => <FiUser size={size} className={className} />;
