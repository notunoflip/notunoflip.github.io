import { Sun, Moon } from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDark, toggleTheme }) => {
  return (
    <header className="bg-gray-200 dark:bg-gray-800 shadow">
      <div className=" px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="logo_flip.png"
            alt="NotUnoFlip logo"
            className="h-8 w-8 rounded"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            NotUnoFlip
          </h1>
        </div>

        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 
                     text-gray-600 dark:text-gray-300 
                     hover:bg-gray-200 dark:hover:bg-gray-600 
                     transition-colors focus:outline-none focus:ring-2 
                     focus:ring-offset-2 focus:ring-blue-500"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
