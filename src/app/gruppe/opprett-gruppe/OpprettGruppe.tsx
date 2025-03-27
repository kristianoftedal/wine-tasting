'use client';

import type React from 'react';

import { Flex } from '@radix-ui/themes';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GroupDocument } from '../../../db-schemas/Group';

interface User {
  _id: string;
  name: string;
  email: string;
}

export default function CreateGroupForm({
  createGroup,
  searchUsers
}: {
  createGroup: (formData: FormData) => Promise<GroupDocument>;
  searchUsers: (query: string) => Promise<User[]>;
}) {
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const router = useRouter();

  const onSearchChanged = async (value: string) => {
    setSearchQuery(value);
    if (searchQuery.trim() && searchQuery.length > 2) {
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
    const group = await createGroup(formData);
    router.push(`/grupper/${group._id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Flex
        direction="column"
        gap="2">
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
            onChange={e => onSearchChanged(e.target.value)}
            placeholder="Search users..."
          />
        </div>
        {searchResults.length > 0 && (
          <>
            <p>Treff: </p>
            <ul className="list border">
              {searchResults.map(user => (
                <li
                  key={user._id}
                  className="padding">
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
          </>
        )}
        {members.length > 0 && (
          <div className="field">
            <p>Valgte medlemmer:</p>
            <ul className="list border">
              {members.map(member => (
                <li
                  key={member._id}
                  className="padding">
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
      </Flex>
      <div className="row">
        <button
          type="submit"
          style={{ marginTop: '1rem' }}
          className="primary">
          Opprett gruppe
        </button>
      </div>
    </form>
  );
}
