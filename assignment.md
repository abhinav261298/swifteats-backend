Real-Time Food Delivery Platform

Design and build a scalable, resilient, and high-performance backend for a modern 
food delivery service. You are required to use AI assistants as collaborative partners to 
brainstorm ideas, evaluate trade-offs, and generate code.

1. Business Scenario
A new startup, " SwiftEats," is launching a food delivery service in Maharashtra. Their 
success hinges on a backend platform that is not only functional but also exceptionally 
reliable and fast, ensuring a seamless experience for customers, restaurants, and drivers.

2. Core Business & Operational Requirements
Your system must solve the following business problems, meeting the specified 
performance and scale targets.
2.1. Reliable Order Processing at Scale The system must be designed to handle a peak 
load of 500 orders per minute. The core order-taking capability should not be 
compromised by the unreliability of third-party services. Mock the payment gateway logic.
2.2. High-Performance Menu & Restaurant Browse Customers expect a fluid, snappy 
Browse experience. To achieve this, the P99 response time for fetching a restaurant's 
menu and its current status must be under 200ms, even under heavy user load.
2.3. Real-Time Logistics and Analytics The platform must be designed to ingest a 
continuous stream of GPS location data from up to 10,000 concurrent drivers, each 
sending an update every 5 seconds (an anticipated peak load of 2,000 events/second). 
This data stream must be used to power a customer-facing feature showing the live 
location of their driver.

Note on Local Testing: While your design should target the scale above, your 
implementation will be validated on a local machine. You should include a data simulator 
that can generate a load of up to 50 drivers (10 events/sec) to demonstrate functionality.

3. Key Architectural Attributes
Your design will be evaluated on its ability to meet these critical non-functional 
requirements:
• Scalability: The architecture must handle the specified peak loads. Different 
components of the system should be scalable independently.
• Resilience: The system must be fault-tolerant. Failure in a non-critical component 
or dependency must not cause a cascading failure of the core platform.
• Performance: The system must meet the defined response time targets for critical 
user-facing interactions.
• Maintainability: The design should be modular to allow for parallel development 
and easy addition of new features.

4. Architectural Considerations & Technology Landscape
To successfully build a system that meets the defined requirements, you will need to make 
deliberate architectural choices. Your design is not limited to just your application code 
and a database. You are encouraged to research, evaluate, and incorporate specialized 
infrastructure components where appropriate to address challenges related to resilience, 
performance, and data distribution.
The choice of architectural pattern is yours, ranging from a well-designed Modular 
Monolith to a distributed Microservices Architecture. To support your design, you might 
consider leveraging tools such as:
• In-memory Caching Layers (e.g., Redis, Memcached)
• Message Queues (e.g., RabbitMQ, Apache ActiveMQ, AWS SQS)
• Event Streaming Platforms (e.g., Apache Kafka, Apache Pulsar, AWS Kinesis)
The selection and justification of your overall architecture and supporting technologies are 
a critical part of your design task and must be detailed in your ARCHITECTURE.md document.

5. Deliverables
Create a private GitHub repo and share with the below members:
Kindly note the names of each of the expected files should be the same. The 
automated evaluation mechanism expects that those file names are accurate, if not 
then it will impact the final score.


Your submission will be a single private GitHub repository containing the following:
1. Source Code: The complete, running source code, including any data simulators 
required for testing.
2. README.md: A clear overview of the project and detailed, step-by-step instructions 
on how to build and run the entire system locally using the docker-compose file.
3. PROJECT_STRUCTURE.md: Explaining the structure of the project and the purpose for 
each of the folder and key modules.
4. ARCHITECTURE.md:
o This is the most important document. It must detail and justify your 
design.
o An explanation of your chosen architectural pattern and why you selected it.
o A diagram illustrating the components and their communication flows.
o A Technology Justification section explaining your choice of major 
technologies (e.g., from the landscape above, or alternatives) and why they 
were the best fit for this problem.
5. API-SPECIFICATION.yml: A clear specification for the APIs you designed (e.g., using 
OpenAPI/Swagger or Postman collection).
o The file name should be POSTMAN_COLLECTION.json in case of a postman 
collection.
o The file name should be API-SPECIFICATION.md if it is a markdown file.
o The file name should be API-SPECIFICATION.yml if it is an API sepecification 
file.
6. docker-compose.yml: A single, working Docker Compose file that starts all required 
components of your system for easy validation.
7. CHAT_HISTORY.md: A summary document that chronicles your design journey with 
your AI assistant, highlighting key decision points and how you used AI to evaluate 
alternatives.
8. Unit Tests & Coverage Report.
9. Video: An 8-10 min video explaining:
o Design, architecture and the different components and how they 
communicate with each other.
o Explain the journey from initial brainstorming till the final implementation 
and the conversation with the coding assistant.
o Key decisions and trade-offs.
o Demo of the entire working of the application.
o Test case coverage %