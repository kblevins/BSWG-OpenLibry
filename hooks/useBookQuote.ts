// hooks/useBookQuote.ts
import { useEffect, useState } from "react";

//this is for loading spinners, to have more fun reading quotes

const QUOTES = [
  {
    text: "A room without books is like a body without a soul.",
    author: "Marcus Tullius Cicero",
  },
  {
    text: "Reading is to the mind what exercise is to the body.",
    author: "Joseph Addison",
  },
  {
    text: "Books are the quietest and most constant of friends.",
    author: "Charles William Eliot",
  },
  {
    text: "A good book is the best of friends.",
    author: "Theodore Roosevelt",
  },
  {
    text: "Not all those who wander are lost.",
    author: "J.R.R. Tolkien",
  },
  {
    text: "Books are mirrors: you only see in them what you already carry within you.",
    author: "Carlos Ruiz Zafón",
  },
  {
    text: "I have always imagined that paradise will be a kind of library.",
    author: "Jorge Luis Borges",
  },
  {
    text: "It is never too late to be what you might have been.",
    author: "George Eliot",
  },
  {
    text: "The art of reading is to skip judiciously.",
    author: "André Maurois",
  },
  {
    text: "A book is like a garden carried in the pocket.",
    author: "Chinese proverb",
  },
  {
    text: "Books are ships of thought on the waves of time.",
    author: "Francis Bacon",
  },
  { text: "Today a reader, tomorrow a leader.", author: "Margaret Fuller" },
  {
    text: "Reading is thinking with someone else's brain.",
    author: "Arthur Schopenhauer",
  },
  { text: "So many books, so little time.", author: "Frank Zappa" },
  {
    text: "Books are the bees which carry the quickening pollen from one to another mind.",
    author: "James Russell Lowell",
  },
  {
    text: "In books lies the soul of the whole past time.",
    author: "Thomas Carlyle",
  },
  {
    text: "Non-readers are no better off than those who cannot read.",
    author: "Mark Twain",
  },
  {
    text: "You can never get a cup of tea large enough or a book long enough to suit me.",
    author: "C.S. Lewis",
  },
  {
    text: "A reader lives a thousand lives before he dies.",
    author: "George R.R. Martin",
  },
  {
    text: "The more that you read, the more things you will know.",
    author: "Dr. Seuss",
  },
];

const INTERVAL_MS = 4000;

export function useBookQuote() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length),
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 400); // fade-out duration before swapping text
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return { quote: QUOTES[index], visible };
}
