#!/bin/bash
# Simple script to run both Node.js tests

echo "======================================="
echo "Running Test 1: Unauthenticated Write"
echo "======================================="
node test1_unauthenticated_write.js

echo -e "\n\n"
echo "======================================="
echo "Running Test 2: Authenticated Write"
echo "======================================="
node test2_authenticated_write.js
