import { useState } from 'react';

interface InterestSelectorProps {
  onStartSearch: (interests: string[]) => void;
  disabled?: boolean;
}

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  onStartSearch,
  disabled = false,
}) => {
  const [interests, setInterests] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const popularInterests = [
    'Music',
    'Gaming',
    'Movies',
    'Sports',
    'Technology',
    'Art',
    'Travel',
    'Books',
    'Cooking',
    'Fitness',
    'Photography',
    'Fashion',
  ];

  const handleAddInterest = (interest: string) => {
    const normalized = interest.trim().toLowerCase();
    if (normalized && !interests.includes(normalized) && interests.length < 10) {
      setInterests([...interests, normalized]);
      setInputValue('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddInterest(inputValue);
    }
  };

  const handleStart = () => {
    onStartSearch(interests);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Add Your Interests</h2>
      <p className="text-gray-600 mb-6">
        Add interests to match with people who share similar hobbies (optional, max 10)
      </p>

      {/* Input */}
      <div className="mb-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an interest and press Enter"
            disabled={disabled || interests.length >= 10}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            maxLength={20}
          />
          <button
            type="button"
            onClick={() => handleAddInterest(inputValue)}
            disabled={disabled || interests.length >= 10 || !inputValue.trim()}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Selected interests */}
      {interests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Interests:</h3>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <span
                key={interest}
                className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
              >
                {interest}
                <button
                  onClick={() => handleRemoveInterest(interest)}
                  className="ml-2 hover:text-primary-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Popular interests */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Popular Interests:</h3>
        <div className="flex flex-wrap gap-2">
          {popularInterests.map((interest) => (
            <button
              key={interest}
              onClick={() => handleAddInterest(interest)}
              disabled={
                disabled || interests.includes(interest.toLowerCase()) || interests.length >= 10
              }
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={disabled}
        className="w-full py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        Start Chatting
      </button>
    </div>
  );
};
