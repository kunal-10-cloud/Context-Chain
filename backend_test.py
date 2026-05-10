import requests
import sys
import json
from datetime import datetime

class ContextHubAPITester:
    def __init__(self, base_url="https://context-chain.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None
        self.session_id = None
        self.discussion_session_id = None
        self.pipeline_session_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success and response.get('status') == 'ok'

    def test_models_list(self):
        """Test models endpoint"""
        success, response = self.run_test(
            "Models List",
            "GET", 
            "models",
            200
        )
        if success:
            models = response if isinstance(response, list) else []
            print(f"   Found {len(models)} models")
            expected_models = ["gpt-5.2", "gpt-4o", "claude-sonnet-4.5", "claude-opus-4.5", "gemini-3-flash"]
            model_keys = [m.get('key') for m in models]
            missing = [m for m in expected_models if m not in model_keys]
            if missing:
                print(f"   Missing models: {missing}")
                return False
            return len(models) == 5
        return False

    def test_create_project(self):
        """Test project creation"""
        test_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "Test project for API testing"
        }
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.project_id = response['id']
            print(f"   Created project ID: {self.project_id}")
            return True
        return False

    def test_list_projects(self):
        """Test listing projects"""
        success, response = self.run_test(
            "List Projects",
            "GET",
            "projects", 
            200
        )
        if success:
            projects = response if isinstance(response, list) else []
            print(f"   Found {len(projects)} projects")
            return len(projects) > 0
        return False

    def test_create_session(self):
        """Test session creation"""
        if not self.project_id:
            print("❌ No project ID available for session creation")
            return False
            
        test_data = {
            "project_id": self.project_id,
            "title": "Test Session",
            "model": "gpt-4o"  # Using gpt-4o for speed as requested
        }
        success, response = self.run_test(
            "Create Session",
            "POST",
            "sessions",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.session_id = response['id']
            print(f"   Created session ID: {self.session_id}")
            return True
        return False

    def test_list_sessions(self):
        """Test listing sessions"""
        params = {"project_id": self.project_id} if self.project_id else None
        success, response = self.run_test(
            "List Sessions",
            "GET",
            "sessions",
            200,
            params=params
        )
        if success:
            sessions = response if isinstance(response, list) else []
            print(f"   Found {len(sessions)} sessions")
            return len(sessions) > 0
        return False

    def test_send_chat_message(self):
        """Test sending a chat message (non-streaming fallback)"""
        if not self.session_id:
            print("❌ No session ID available for chat")
            return False
            
        test_data = {
            "session_id": self.session_id,
            "content": "Hello! This is a test message. Please respond briefly."
        }
        success, response = self.run_test(
            "Send Chat Message (Non-streaming)",
            "POST",
            "chat",
            200,
            data=test_data
        )
        if success and 'message' in response:
            message = response['message']
            print(f"   AI Response: {message.get('content', '')[:100]}...")
            return True
        return False

    def test_send_chat_stream(self):
        """Test SSE streaming chat endpoint"""
        if not self.session_id:
            print("❌ No session ID available for streaming chat")
            return False
            
        url = f"{self.base_url}/api/chat/stream"
        headers = {'Content-Type': 'application/json'}
        test_data = {
            "session_id": self.session_id,
            "content": "Tell me a short joke. Keep it brief."
        }
        
        self.tests_run += 1
        print(f"\n🔍 Testing SSE Chat Streaming...")
        print(f"   URL: {url}")
        
        try:
            import sseclient  # For SSE parsing
        except ImportError:
            # Fallback to manual parsing
            pass
            
        try:
            response = requests.post(url, json=test_data, headers=headers, stream=True, timeout=60)
            
            if response.status_code != 200:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                return False
                
            # Parse SSE events
            events_received = []
            content_chunks = []
            
            for line in response.iter_lines(decode_unicode=True):
                if line.startswith('data: '):
                    try:
                        event_data = json.loads(line[6:])  # Remove 'data: ' prefix
                        events_received.append(event_data['type'])
                        
                        if event_data['type'] == 'start':
                            print(f"   📡 Stream started with message ID: {event_data.get('message_id', 'N/A')}")
                        elif event_data['type'] == 'chunk':
                            content_chunks.append(event_data['content'])
                            print(f"   📝 Chunk: '{event_data['content']}'")
                        elif event_data['type'] == 'done':
                            print(f"   ✅ Stream completed with message ID: {event_data.get('message_id', 'N/A')}")
                            break
                        elif event_data['type'] == 'error':
                            print(f"   ❌ Stream error: {event_data.get('detail', 'Unknown error')}")
                            return False
                            
                    except json.JSONDecodeError:
                        continue  # Skip malformed events
                        
            # Validate streaming behavior
            full_content = ''.join(content_chunks)
            expected_events = ['start', 'chunk', 'done']
            
            success = (
                'start' in events_received and 
                'chunk' in events_received and 
                'done' in events_received and
                len(content_chunks) > 0 and
                len(full_content.strip()) > 0
            )
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Received {len(content_chunks)} chunks")
                print(f"   Full response: {full_content[:100]}...")
                return True
            else:
                print(f"❌ Failed - Events: {events_received}, Chunks: {len(content_chunks)}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_get_messages(self):
        """Test getting session messages"""
        if not self.session_id:
            print("❌ No session ID available for messages")
            return False
            
        success, response = self.run_test(
            "Get Session Messages",
            "GET",
            f"sessions/{self.session_id}/messages",
            200
        )
        if success:
            messages = response if isinstance(response, list) else []
            print(f"   Found {len(messages)} messages")
            return len(messages) >= 2  # Should have user + assistant message
        return False

    def test_extract_intelligence(self):
        """Test intelligence extraction"""
        if not self.session_id:
            print("❌ No session ID available for extraction")
            return False
            
        success, response = self.run_test(
            "Extract Intelligence",
            "POST",
            f"sessions/{self.session_id}/extract",
            200
        )
        if success and 'items' in response:
            items = response['items']
            print(f"   Extracted {len(items)} intelligence items")
            return True
        return False

    def test_get_intelligence(self):
        """Test getting intelligence items"""
        params = {"project_id": self.project_id} if self.project_id else None
        success, response = self.run_test(
            "Get Intelligence",
            "GET",
            "intelligence",
            200,
            params=params
        )
        if success:
            items = response if isinstance(response, list) else []
            print(f"   Found {len(items)} intelligence items")
            return True
        return False

    def test_create_discussion_session(self):
        """Test creating a multi-agent discussion session"""
        if not self.project_id:
            print("❌ No project ID available for discussion session creation")
            return False
            
        test_data = {
            "project_id": self.project_id,
            "title": "Test Discussion Session",
            "model": "claude-sonnet-4.5",  # Will be overridden by agents[0]
            "mode": "discussion",
            "agents": ["claude-sonnet-4.5", "claude-opus-4.5"]
        }
        success, response = self.run_test(
            "Create Discussion Session",
            "POST",
            "sessions",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.discussion_session_id = response['id']
            print(f"   Created discussion session ID: {self.discussion_session_id}")
            # Verify mode and agents
            if response.get('mode') == 'discussion' and len(response.get('agents', [])) == 2:
                print(f"   ✅ Mode: {response['mode']}, Agents: {response['agents']}")
                return True
            else:
                print(f"   ❌ Unexpected response: mode={response.get('mode')}, agents={response.get('agents')}")
                return False
        return False

    def test_create_pipeline_session(self):
        """Test creating a multi-agent pipeline session"""
        if not self.project_id:
            print("❌ No project ID available for pipeline session creation")
            return False
            
        test_data = {
            "project_id": self.project_id,
            "title": "Test Pipeline Session",
            "model": "claude-sonnet-4.5",
            "mode": "pipeline",
            "agents": ["claude-sonnet-4.5", "claude-opus-4.5"]
        }
        success, response = self.run_test(
            "Create Pipeline Session",
            "POST",
            "sessions",
            200,
            data=test_data
        )
        if success and 'id' in response:
            self.pipeline_session_id = response['id']
            print(f"   Created pipeline session ID: {self.pipeline_session_id}")
            # Verify mode and agents
            if response.get('mode') == 'pipeline' and len(response.get('agents', [])) == 2:
                print(f"   ✅ Mode: {response['mode']}, Agents: {response['agents']}")
                return True
            else:
                print(f"   ❌ Unexpected response: mode={response.get('mode')}, agents={response.get('agents')}")
                return False
        return False

    def test_multi_agent_stream(self):
        """Test multi-agent SSE streaming endpoint"""
        if not hasattr(self, 'discussion_session_id') or not self.discussion_session_id:
            print("❌ No discussion session ID available for multi-agent streaming")
            return False
            
        url = f"{self.base_url}/api/chat/multi-stream"
        headers = {'Content-Type': 'application/json'}
        test_data = {
            "session_id": self.discussion_session_id,
            "content": "What is 2+2? Keep it very brief."
        }
        
        self.tests_run += 1
        print(f"\n🔍 Testing Multi-Agent SSE Streaming...")
        print(f"   URL: {url}")
        
        try:
            response = requests.post(url, json=test_data, headers=headers, stream=True, timeout=120)
            
            if response.status_code != 200:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                try:
                    error = response.json()
                    print(f"   Error: {error}")
                except:
                    print(f"   Error: {response.text}")
                return False
                
            # Parse SSE events
            events_received = []
            agent_responses = {}
            current_agent = None
            
            for line in response.iter_lines(decode_unicode=True):
                if line.startswith('data: '):
                    try:
                        event_data = json.loads(line[6:])
                        event_type = event_data['type']
                        events_received.append(event_type)
                        
                        if event_type == 'multi_start':
                            print(f"   📡 Multi-agent stream started")
                            print(f"      Mode: {event_data.get('mode')}, Agents: {event_data.get('agents')}")
                        elif event_type == 'agent_start':
                            current_agent = event_data['agent']
                            agent_responses[current_agent] = []
                            print(f"   🤖 Agent {current_agent} started (step {event_data['step']}/{event_data['total_steps']})")
                        elif event_type == 'chunk':
                            if current_agent:
                                agent_responses[current_agent].append(event_data['content'])
                        elif event_type == 'agent_done':
                            agent = event_data['agent']
                            content = ''.join(agent_responses.get(agent, []))
                            print(f"   ✅ Agent {agent} done - Response: {content[:80]}...")
                        elif event_type == 'done':
                            print(f"   ✅ Multi-agent stream completed")
                            break
                        elif event_type == 'error' or event_type == 'agent_error':
                            print(f"   ❌ Stream error: {event_data.get('detail', 'Unknown error')}")
                            return False
                            
                    except json.JSONDecodeError:
                        continue
                        
            # Validate multi-agent streaming behavior
            expected_events = ['multi_start', 'agent_start', 'chunk', 'agent_done', 'done']
            success = (
                'multi_start' in events_received and 
                'agent_start' in events_received and 
                'chunk' in events_received and 
                'agent_done' in events_received and
                'done' in events_received and
                len(agent_responses) == 2  # Should have 2 agents
            )
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Received responses from {len(agent_responses)} agents")
                for agent, chunks in agent_responses.items():
                    print(f"   Agent {agent}: {len(chunks)} chunks")
                return True
            else:
                print(f"❌ Failed - Events: {set(events_received)}, Agents: {len(agent_responses)}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

def main():
    print("🚀 Starting Context Hub API Tests...")
    print("=" * 50)
    
    tester = ContextHubAPITester()
    
    # Run all tests in sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Models List", tester.test_models_list),
        ("Create Project", tester.test_create_project),
        ("List Projects", tester.test_list_projects),
        ("Create Session", tester.test_create_session),
        ("List Sessions", tester.test_list_sessions),
        ("Send Chat Message (Non-streaming)", tester.test_send_chat_message),
        ("SSE Chat Streaming", tester.test_send_chat_stream),
        ("Get Messages", tester.test_get_messages),
        ("Extract Intelligence", tester.test_extract_intelligence),
        ("Get Intelligence", tester.test_get_intelligence),
        ("Create Discussion Session", tester.test_create_discussion_session),
        ("Create Pipeline Session", tester.test_create_pipeline_session),
        ("Multi-Agent SSE Streaming", tester.test_multi_agent_stream),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())