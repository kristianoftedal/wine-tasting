'use client';

import type React from 'react';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
}

export default function CreateGroupForm({
  createGroup,
  searchUsers
}: {
  createGroup: (formData: FormData) => Promise<void>;
  searchUsers: (query: string) => Promise<User[]>;
}) {
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const router = useRouter();

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addMember = (user: User) => {
    if (!members.some(member => member._id === user._id)) {
      setMembers([...members, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMember = (userId: string) => {
    setMembers(members.filter(member => member._id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', groupName);
    members.forEach(member => formData.append('members', member._id));
    await createGroup(formData);
    router.push('/');
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card">
      <div className="field label border">
        <input
          type="text"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          required
          placeholder="Group Name"
        />
      </div>
      <div className="field label border">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search users..."
        />
        <button
          type="button"
          onClick={handleSearch}
          className="border">
          Search
        </button>
      </div>
      {searchResults.length > 0 && (
        <div className="field">
          <ul className="collection">
            {searchResults.map(user => (
              <li
                key={user._id}
                className="collection-item">
                {user.name} ({user.email})
                <button
                  type="button"
                  onClick={() => addMember(user)}
                  className="secondary small right">
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {members.length > 0 && (
        <div className="field">
          <h3>Selected Members:</h3>
          <ul className="collection">
            {members.map(member => (
              <li
                key={member._id}
                className="collection-item">
                {member.name} ({member.email})
                <button
                  type="button"
                  onClick={() => removeMember(member._id)}
                  className="error small right">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="field">
        <button
          type="submit"
          className="primary">
          Create Group
        </button>
      </div>
    </form>
  );
}
